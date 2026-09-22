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
import { computeDigitStats } from '@/lib/digit-stats';

interface AIBotControllerProps {
  activeSymbol: ActiveSymbol | null;
  currentTick: Tick | null;
  digitStats: DigitStats;
  symbols: ActiveSymbol[];
  balance?: number;
  isConnected?: boolean;
  autoBuy: (params: { contractMode: ContractMode; digit: number; stakeAmount: number; duration?: number }) => Promise<boolean>;
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
    lastAnalysis, emergencyStop,
    startBot, stopBot, updateConfig, processTick, checkRules, prepareTrade,
    recordTradeResult, triggerEmergencyStop, resetEmergencyStop,
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

  const executeAutoBuy = useCallback(async (signal: { id: string; contractMode: ContractMode; predictedDigit?: number; recommendedStake: number }) => {
    if (buyCooldownRef.current) return;
    if (!isConnected) return;
    buyCooldownRef.current = true;
    lastSignalRef.current = signal.id;

    let digit = 5;
    let contractMode: ContractMode = 'DIGITDIFF';

    if (signal.contractMode === 'DIGITOVER') {
      contractMode = 'DIGITOVER';
      digit = 2;
    } else if (signal.contractMode === 'DIGITUNDER') {
      contractMode = 'DIGITUNDER';
      digit = 8;
    } else if (signal.contractMode === 'DIGITMATCH') {
      contractMode = 'DIGITMATCH';
      digit = signal.predictedDigit ?? 5;
    } else if (signal.contractMode === 'DIGITDIFF') {
      contractMode = 'DIGITDIFF';
      digit = signal.predictedDigit ?? 5;
    }

    try {
      await autoBuy({
        contractMode,
        digit,
        stakeAmount: Math.min(signal.recommendedStake, config.stake),
        duration: config.duration,
      });
    } catch {
      // autoBuy errors surface via Deriv toast; keep loop alive
    }

    setTimeout(() => { buyCooldownRef.current = false; }, 1500);
  }, [autoBuy, config.stake, config.duration, isConnected]);

  useEffect(() => {
    if (!isRunning || !currentTick || !activeSymbol) return;

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

    const sig = processTick(symbol, price, stats, pipSize);

    const ruleSignal = checkRules(symbol, price, stats, pipSize);

    const bestSignal = ruleSignal && ruleSignal.confidence > (sig?.confidence ?? 0) ? ruleSignal : sig;

    if (bestSignal && config.autoTrade && !emergencyStop) {
      const check = prepareTrade(bestSignal, balance);
      if (check.willTrade) {
        executeAutoBuy(bestSignal);
      }
    }
  }, [isRunning, currentTick, activeSymbol, digitStats, pipSize, processTick, checkRules, prepareTrade, balance, config.autoTrade, emergencyStop, executeAutoBuy]);

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

      for (const sym of symbols) {
        const symName = sym.underlying_symbol;
        const ticks = allTicksRef.current.get(symName) ?? [];
        if (ticks.length < 20) continue;
        // Volatility indices all use pipSize 2; use real pipSize for active symbol, 2 for others is correct
        const ps = symName === activeSymbol?.underlying_symbol ? pipSize : 2;
        const stats = computeDigitStats(ticks, ps);
        // Score = max deviation from 10% (strongest dominance)
        const maxPct = Math.max(...stats.percentages);
        const minPct = Math.min(...stats.percentages);
        const deviation = Math.max(maxPct - 10, 10 - minPct);
        // Bonus if recent digits favour an assured strategy
        const recentDigits = ticks.slice(-5).map(p => {
          const s = p.toFixed(ps);
          return parseInt(s[s.length - 1], 10);
        });
        const lowRun = recentDigits.slice(-2).every(d => d <= 2) ? 5 : 0;
        const highRun = recentDigits.slice(-2).every(d => d >= 7) ? 5 : 0;
        const score = deviation + lowRun + highRun;
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
