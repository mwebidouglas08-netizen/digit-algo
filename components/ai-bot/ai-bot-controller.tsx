'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AIBotPanel } from './ai-bot-panel';
import { useAIBot } from './use-ai-bot';
import { useDerivWSContext } from '@/components/custom/deriv-ws-provider';
import { cn } from '@/lib/utils';
import type { ActiveSymbol, Tick, BuyResult } from '@deriv/core';
import type { DigitStats, ContractMode, OpenPosition } from '@/lib/types';
import { computeDigitStats, getLastDigit } from '@/lib/digit-stats';

interface AIBotControllerProps {
  activeSymbol: ActiveSymbol | null;
  currentTick: Tick | null;
  digitStats: DigitStats;
  symbols: ActiveSymbol[];
  balance?: number;
  isConnected?: boolean;
  autoBuy: (params: { contractMode: ContractMode; digit: number; stakeAmount: number; duration?: number; confidence?: number }) => Promise<boolean>;
  buyResult: BuyResult | null;
  openPositions: OpenPosition[];
  selectSymbol: (symbol: string) => void;
  pipSize: number;
}

export function AIBotController({
  activeSymbol,
  currentTick,
  digitStats,
  symbols,
  balance = 0,
  isConnected = false,
  autoBuy,
  buyResult,
  openPositions,
  selectSymbol,
  pipSize,
}: AIBotControllerProps) {
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [tickCount, setTickCount] = useState(0);
  const [mounted, setMounted] = useState(false);
  const { ws } = useDerivWSContext();
  const allTicksRef = useRef<Map<string, number[]>>(new Map());
  const subscriptionsRef = useRef<Map<string, () => void>>(new Map());
  const buyCooldownRef = useRef(false);
  const pendingTradesRef = useRef<Map<number, { signalId: string; stake: number }>>(new Map());
  const lastBuyResultRef = useRef<BuyResult | null>(null);
  const lastSignalRef = useRef<string | null>(null);

  const {
    isRunning, config, activities, signals, tradeHistory, dailyStats,
    lastAnalysis, emergencyStop, validation,
    startBot, stopBot, updateConfig, processTick, checkRules, checkEvenOdd, checkOver3Under6, peekOver2, peekUnder8, ingestTick, prepareTrade,
    recordTradeResult, triggerEmergencyStop, resetEmergencyStop,
    isRiskAcceptable, runValidation, runBacktest, getDrawdown, runPeriodicValidation, getStrategyHealth,
  } = useAIBot();

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (buyResult && buyResult !== lastBuyResultRef.current) {
      lastBuyResultRef.current = buyResult;
      const signalId = lastSignalRef.current ?? 'unknown';
      pendingTradesRef.current.set(buyResult.contractId, { signalId, stake: buyResult.buyPrice });
    }
  }, [buyResult]);

  useEffect(() => {
    for (const pos of openPositions) {
      if (!pendingTradesRef.current.has(pos.contract_id)) continue;
      const isClosed = !!pos.is_sold || !!pos.is_expired || (pos.status !== 'open' && pos.status !== '');
      if (!isClosed) continue;

      const profit = parseFloat(pos.profit) || 0;
      const result: 'WIN' | 'LOSS' = profit >= 0 ? 'WIN' : 'LOSS';
      const pending = pendingTradesRef.current.get(pos.contract_id);

      if (pending) {
        recordTradeResult(pending.signalId, result, profit);
      }
      pendingTradesRef.current.delete(pos.contract_id);
    }
  }, [openPositions, recordTradeResult]);

  const handleStart = useCallback(() => {
    const volSymbols = symbols
      .filter(s => s.underlying_symbol.toLowerCase().includes('volatility'))
      .map(s => s.underlying_symbol);
    const finalSymbols = volSymbols.length > 0 ? volSymbols : symbols.map(s => s.underlying_symbol);
    startBot(finalSymbols);
  }, [symbols, startBot]);

  const executeAutoBuy = useCallback(async (signal: { id: string; contractMode: ContractMode; predictedDigit?: number; recommendedStake: number; confidence: number }) => {
    if (buyCooldownRef.current) return;
    if (!isConnected) return;
    // Pre-trade risk gate — remain inactive if risk exceeds threshold
    const risk = isRiskAcceptable(signal as unknown as import('./ai-bot-engine').TradeSignal, balance);
    if (!risk.ok) return;
    buyCooldownRef.current = true;
    lastSignalRef.current = signal.id;

    // Production: support all verified markets — over/under, even/odd, matches/differs
    // Digit is barrier for over/under/match/diff, ignored for even/odd (sent as 0)
    const contractMode: ContractMode = signal.contractMode;
    let digit = signal.predictedDigit ?? 5;
    if (contractMode === 'DIGITOVER' && signal.predictedDigit === undefined) digit = 2;
    if (contractMode === 'DIGITUNDER' && signal.predictedDigit === undefined) digit = 8;
    if (contractMode === 'DIGITEVEN' || contractMode === 'DIGITODD') digit = 0;

    try {
      // autoBuy now verifies expected profit (EV>0, payout>stake) before buying — no blind trades
      await autoBuy({
        contractMode,
        digit,
        stakeAmount: Math.min(signal.recommendedStake, config.stake),
        duration: config.duration,
        confidence: signal.confidence,
      });
    } catch {
      // autoBuy errors surface via Deriv toast; keep loop alive
    }

    setTimeout(() => { buyCooldownRef.current = false; }, 1000);
  }, [autoBuy, config.stake, config.duration, isConnected, isRiskAcceptable, balance]);

  // Periodic AI validation: backtest + OOS + health check every ~90s while running — keeps strategies effective as market changes
  useEffect(() => {
    if (!isRunning || !isConnected) return;
    const id = setInterval(() => {
      runPeriodicValidation(activeSymbol?.underlying_symbol);
    }, 90_000);
    return () => clearInterval(id);
  }, [isRunning, isConnected, activeSymbol, runPeriodicValidation]);

  useEffect(() => {
    if (!isRunning || !currentTick || !activeSymbol) return;
    // Real-time sync guard: skip stale ticks (>3s old) — prevents trading on delayed data
    const tickEpochMs = (currentTick.epoch ?? 0) * 1000;
    if (tickEpochMs && Date.now() - tickEpochMs > 3000) return;

    const symbol = activeSymbol.underlying_symbol;
    const price = currentTick.quote;

    const ticks = allTicksRef.current.get(symbol) ?? [];
    ticks.push(price);
    if (ticks.length > 200) ticks.shift();
    allTicksRef.current.set(symbol, ticks);
    setTickCount(prev => prev + 1);

    // Use real digitStats from production ticks when available (pipSize-accurate),
    // fallback to local ticks with real pipSize for early startup.
    const stats = digitStats.totalTicks >= 10 ? digitStats : computeDigitStats(ticks, pipSize);

    // AI analyses active market thoroughly, then scans ALL volatility markets for Over2/Under8 the moment conditions are met
    const sig = processTick(symbol, price, stats, pipSize);
    const ruleSignal = checkRules(symbol, price, stats, pipSize);
    const evenOddSignal = checkEvenOdd(symbol, stats);
    const over3Under6Signal = checkOver3Under6(symbol, stats);
    let candidates = [sig, ruleSignal, evenOddSignal, over3Under6Signal].filter(Boolean) as (typeof sig)[];

    // Comprehensive scan: evaluate Over2/Under8 on EVERY volatility market with real ticks — ensures no opportunity missed
    for (const sym of symbols) {
      if (sym.underlying_symbol === symbol) continue; // already evaluated as active
      const t = allTicksRef.current.get(sym.underlying_symbol) ?? [];
      if (t.length < 20) continue;
      const ps = 2; // volatility indices pipSize is 2
      const sStats = computeDigitStats(t, ps);
      if (sStats.totalTicks < 20) continue;
      const last = getLastDigit(t[t.length - 1], ps);
      const prev = getLastDigit(t[t.length - 2], ps);
      const o2 = peekOver2(sym.underlying_symbol, last, prev, sStats);
      if (o2) candidates.push(o2);
      const u8 = peekUnder8(sym.underlying_symbol, last, prev, sStats);
      if (u8) candidates.push(u8);
      // Even/Odd and Over3/Under6 also scanned if enabled
      const eo = checkEvenOdd(sym.underlying_symbol, sStats);
      if (eo) candidates.push(eo);
      const o3 = checkOver3Under6(sym.underlying_symbol, sStats);
      if (o3) candidates.push(o3);
    }
    // AI decision: select highest-confidence validated signal across ALL markets — never force when none meet threshold
    const bestSignal = candidates.length ? candidates.reduce((a, b) => (a!.confidence > b!.confidence ? a : b), candidates[0])! : null;

    if (bestSignal && config.autoTrade && !emergencyStop) {
      // Risk threshold: remain inactive if expected risk exceeds configured threshold — never blind
      const riskOk = isRiskAcceptable(bestSignal as unknown as import('./ai-bot-engine').TradeSignal, balance);
      if (!riskOk.ok) return;
      const check = prepareTrade(bestSignal, balance);
      if (check.willTrade) {
        // If best opportunity is on a different volatility market, switch first then execute — ensures Over/Under trades on favourable market immediately
        if (bestSignal.symbol !== symbol) {
          selectSymbol(bestSignal.symbol);
          // Execute after symbol switch settles (proposal needs new symbol) — still within same favourable window
          setTimeout(() => {
            executeAutoBuy(bestSignal as { id: string; contractMode: ContractMode; predictedDigit?: number; recommendedStake: number; confidence: number });
          }, 500);
        } else {
          executeAutoBuy(bestSignal as { id: string; contractMode: ContractMode; predictedDigit?: number; recommendedStake: number; confidence: number });
        }
      }
    }
  }, [isRunning, currentTick, activeSymbol, digitStats, pipSize, symbols, processTick, checkRules, checkEvenOdd, checkOver3Under6, peekOver2, peekUnder8, prepareTrade, balance, config.autoTrade, emergencyStop, executeAutoBuy, isRiskAcceptable, selectSymbol]);

  // Multi-market scan: every scanInterval, look at REAL digit distribution across all
  // subscribed markets and auto-switch to the market with strongest edge.
  // This uses local tick buffers with real pipSize — no simulation, no fake ticks.
  useEffect(() => {
    if (!isRunning || !ws || !isConnected || symbols.length === 0) return;

    const interval = setInterval(() => {
      // Avoid flip-flopping — don't switch if we traded < 5s ago or have open positions
      if (buyCooldownRef.current) return;
      let bestSymbol: string | null = null;
      let bestScore = 0;

      const health = getStrategyHealth();
      // Respect user market filter: if config.markets non-empty, only score those display names
      const allowed = config.markets && config.markets.length > 0
        ? new Set(config.markets.map(m => m.toLowerCase()))
        : null;
      for (const sym of symbols) {
        const symName = sym.underlying_symbol;
        // Filter by user-selected markets (e.g., 'Volatility 100' matches underlying_symbol_name)
        const displayLower = (sym.underlying_symbol_name ?? sym.submarket_display_name ?? sym.market_display_name ?? '').toLowerCase();
        if (allowed && !allowed.has(displayLower) && !allowed.has(symName.toLowerCase())) {
          // also allow by underlying symbol prefix match (R_100 etc.)
          const match = Array.from(allowed).some(a => symName.toLowerCase().includes(a.replace(/\s+/g, '').toLowerCase()) || displayLower.includes(a));
          if (!match) continue;
        }
        const ticks = allTicksRef.current.get(symName) ?? [];
        if (ticks.length < 20) continue;
        // Volatility indices all use pipSize 2; use real pipSize for active symbol, 2 for others is correct
        const ps = symName === activeSymbol?.underlying_symbol ? pipSize : 2;
        const stats = computeDigitStats(ticks, ps);
        // Score = max deviation from 10% (strongest dominance)
        const maxPct = Math.max(...stats.percentages);
        const minPct = Math.min(...stats.percentages);
        const deviation = Math.max(maxPct - 10, 10 - minPct);
        // Bonus if recent digits favour an assured *and still-validated* strategy
        const recentDigits = ticks.slice(-5).map(p => {
          const s = p.toFixed(ps);
          return parseInt(s[s.length - 1], 10);
        });
        const lowEnabled = config.over2Enabled && config.tradeMode !== 'evenOdd' && health.get('over2')?.enabled !== false;
        const highEnabled = config.under8Enabled && config.tradeMode !== 'evenOdd' && health.get('under8')?.enabled !== false;
        const lowRun = lowEnabled && recentDigits.slice(-2).every(d => d <= 2) ? 5 : 0;
        const highRun = highEnabled && recentDigits.slice(-2).every(d => d >= 7) ? 5 : 0;
        // Even/Odd parity streak bonus — only if Even/Odd actually enabled (default off)
        const evenEnabled = config.evenOddEnabled && config.tradeMode !== 'overUnder' && health.get('evenOdd')?.enabled !== false;
        let parityBonus = 0;
        if (evenEnabled && recentDigits.length >= 3) {
          const last3 = recentDigits.slice(-3);
          const allEven = last3.every(d => d % 2 === 0);
          const allOdd = last3.every(d => d % 2 === 1);
          if (allEven || allOdd) parityBonus = 4;
        }
        const score = deviation + lowRun + highRun + parityBonus;
        if (score > bestScore && score >= 4) {
          bestScore = score;
          bestSymbol = symName;
        }
      }

      if (bestSymbol && bestSymbol !== activeSymbol?.underlying_symbol) {
        selectSymbol(bestSymbol);
      }
    }, config.scanInterval || 3000);

    return () => clearInterval(interval);
  }, [isRunning, ws, isConnected, symbols, activeSymbol, pipSize, selectSymbol, config.scanInterval]);

  useEffect(() => {
    if (!isRunning || !ws || !isConnected || symbols.length === 0) return;

    symbols.forEach(symbol => {
      const sym = symbol.underlying_symbol;
      if (subscriptionsRef.current.has(sym)) return;

      ws.subscribe({
        ticks_history: sym,
        adjust_start_time: 1,
        count: 200,
        end: 'latest',
        style: 'ticks',
      }, (data: Record<string, unknown>) => {
        const tickData = data.tick as { quote?: number } | undefined;
        if (tickData?.quote !== undefined) {
          const ticks = allTicksRef.current.get(sym) ?? [];
          ticks.push(tickData.quote);
          if (ticks.length > 200) ticks.shift();
          allTicksRef.current.set(sym, ticks);
          // Keep AI engine history in sync for pip-accurate over/under analysis on ALL volatility markets
          ingestTick(sym, tickData.quote, sym === activeSymbol?.underlying_symbol ? pipSize : 2);
        }
      }).then(result => {
        if (result.subscriptionId) subscriptionsRef.current.set(sym, result.unsubscribe);
      }).catch(() => {});
    });

    return () => {
      subscriptionsRef.current.forEach(unsub => { try { unsub(); } catch {} });
      subscriptionsRef.current.clear();
    };
  }, [isRunning, ws, isConnected, symbols]);

  const drawdown = getDrawdown();
  const strategyHealth = getStrategyHealth();
  const panelEl = mounted ? createPortal(
    <AIBotPanel
      isOpen={isPanelOpen}
      onClose={() => setIsPanelOpen(false)}
      isRunning={isRunning}
      config={config}
      activities={activities}
      signals={signals}
      tradeHistory={tradeHistory}
      dailyStats={dailyStats}
      lastAnalysis={lastAnalysis}
      emergencyStop={emergencyStop}
      onStart={handleStart}
      onStop={stopBot}
      onUpdateConfig={updateConfig}
      onEmergencyStop={triggerEmergencyStop}
      onResetEmergencyStop={resetEmergencyStop}
      balance={balance}
      tickCount={tickCount}
      currentSymbol={activeSymbol?.underlying_symbol ?? null}
      isConnected={isConnected}
      validation={validation}
      drawdown={drawdown}
      onRunValidation={() => runValidation(activeSymbol?.underlying_symbol) ?? null}
      onRunBacktest={() => runBacktest(activeSymbol?.underlying_symbol) ?? null}
      strategyHealth={strategyHealth}
    />,
    document.body
  ) : null;

  return (
    <>
      <Button
        variant={isRunning ? 'default' : 'outline'}
        size="sm"
        onClick={() => setIsPanelOpen(true)}
        className={cn(
          "relative gap-2 h-9 px-3 font-semibold shrink-0 cursor-pointer",
          isRunning
            ? "bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/25"
            : "border-emerald-500/50 text-emerald-600 hover:bg-emerald-500/10"
        )}
      >
        {isRunning && (
          <span className="absolute -top-1 -right-1 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-white" />
          </span>
        )}
        <Zap className="h-4 w-4" />
        <span>AI Bot</span>
      </Button>
      {panelEl}
    </>
  );
}
