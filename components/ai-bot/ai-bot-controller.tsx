'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AIBotPanel } from './ai-bot-panel';
import { useAIBot } from './use-ai-bot';
import { useDerivWSContext } from '@/components/custom/deriv-ws-provider';
import { cn } from '@/lib/utils';
import type { ActiveSymbol, Tick } from '@deriv/core';
import type { DigitStats, ContractMode } from '@/lib/types';
import { computeDigitStats } from '@/lib/digit-stats';

interface AIBotControllerProps {
  activeSymbol: ActiveSymbol | null;
  currentTick: Tick | null;
  digitStats: DigitStats;
  symbols: ActiveSymbol[];
  balance?: number;
  isConnected?: boolean;
  onBuy: () => void;
  autoBuy: (params: { contractMode: ContractMode; digit: number; stakeAmount: number }) => Promise<boolean>;
}

export function AIBotController({
  activeSymbol,
  currentTick,
  digitStats,
  symbols,
  balance = 0,
  isConnected = false,
  autoBuy,
}: AIBotControllerProps) {
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [tickCount, setTickCount] = useState(0);
  const [mounted, setMounted] = useState(false);
  const { ws } = useDerivWSContext();
  const allTicksRef = useRef<Map<string, number[]>>(new Map());
  const subscriptionsRef = useRef<Map<string, () => void>>(new Map());
  const buyCooldownRef = useRef(false);

  const {
    isRunning, config, activities, signals, tradeHistory, dailyStats,
    lastAnalysis, emergencyStop,
    startBot, stopBot, updateConfig, processTick, checkRules, prepareTrade,
    triggerEmergencyStop, resetEmergencyStop,
  } = useAIBot();

  useEffect(() => { setMounted(true); }, []);

  const handleStart = useCallback(() => {
    const volSymbols = symbols
      .filter(s => s.underlying_symbol.toLowerCase().includes('volatility'))
      .map(s => s.underlying_symbol);
    const finalSymbols = volSymbols.length > 0 ? volSymbols : symbols.map(s => s.underlying_symbol);
    startBot(finalSymbols);
  }, [symbols, startBot]);

  const executeAutoBuy = useCallback(async (signal: { contractMode: ContractMode; predictedDigit?: number; recommendedStake: number }) => {
    if (buyCooldownRef.current) return;
    buyCooldownRef.current = true;

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

    const success = await autoBuy({
      contractMode,
      digit,
      stakeAmount: Math.min(signal.recommendedStake, config.stake),
    });

    setTimeout(() => { buyCooldownRef.current = false; }, 3000);
  }, [autoBuy, config.stake]);

  useEffect(() => {
    if (!isRunning || !currentTick || !activeSymbol) return;

    const symbol = activeSymbol.underlying_symbol;
    const price = currentTick.quote;

    const ticks = allTicksRef.current.get(symbol) ?? [];
    ticks.push(price);
    if (ticks.length > 200) ticks.shift();
    allTicksRef.current.set(symbol, ticks);
    setTickCount(prev => prev + 1);

    const stats = computeDigitStats(ticks, 2);

    const ruleSignal = checkRules(symbol, price, stats);
    if (ruleSignal && config.autoTrade && !emergencyStop) {
      const check = prepareTrade(ruleSignal, balance);
      if (check.willTrade) {
        executeAutoBuy(ruleSignal);
      }
      return;
    }

    const sig = processTick(symbol, price, stats);
    if (sig && config.autoTrade && !emergencyStop) {
      const check = prepareTrade(sig, balance);
      if (check.willTrade) {
        executeAutoBuy(sig);
      }
    }
  }, [isRunning, currentTick, activeSymbol, processTick, checkRules, prepareTrade, balance, config.autoTrade, emergencyStop, executeAutoBuy]);

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

    return () => {};
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
