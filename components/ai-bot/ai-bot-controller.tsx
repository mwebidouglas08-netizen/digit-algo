'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AIBotPanel } from './ai-bot-panel';
import { useAIBot } from './use-ai-bot';
import { useDerivWSContext } from '@/components/custom/deriv-ws-provider';
import { cn } from '@/lib/utils';
import type { ActiveSymbol, Tick } from '@deriv/core';
import type { DigitStats } from '@/lib/types';
import { computeDigitStats } from '@/lib/digit-stats';

interface AIBotControllerProps {
  activeSymbol: ActiveSymbol | null;
  currentTick: Tick | null;
  digitStats: DigitStats;
  symbols: ActiveSymbol[];
  balance?: number;
  isConnected?: boolean;
  onBuy: () => void;
  stake?: number;
  duration?: number;
}

export function AIBotController({
  activeSymbol,
  currentTick,
  digitStats,
  symbols,
  balance = 0,
  isConnected = false,
  onBuy,
  stake = 1,
  duration = 5,
}: AIBotControllerProps) {
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [tickCount, setTickCount] = useState(0);
  const { ws } = useDerivWSContext();
  const allTicksRef = useRef<Map<string, number[]>>(new Map());
  const subscriptionsRef = useRef<Map<string, () => void>>(new Map());

  const {
    isRunning, config, activities, signals, tradeHistory, dailyStats,
    lastAnalysis, emergencyStop,
    startBot, stopBot, updateConfig, processTick, prepareTrade,
    triggerEmergencyStop, resetEmergencyStop,
  } = useAIBot();

  const handleStart = useCallback(() => {
    const volSymbols = symbols
      .filter(s => s.underlying_symbol.toLowerCase().includes('volatility'))
      .map(s => s.underlying_symbol);
    const finalSymbols = volSymbols.length > 0 ? volSymbols : symbols.map(s => s.underlying_symbol);
    startBot(finalSymbols);
  }, [symbols, startBot]);

  const handleAutoBuy = useCallback(() => {
    if (config.autoTrade) {
      onBuy();
    }
  }, [config.autoTrade, onBuy]);

  useEffect(() => {
    if (!isRunning || !ws || !isConnected) return;

    const processAllTicks = (symbol: string, price: number) => {
      const ticks = allTicksRef.current.get(symbol) ?? [];
      ticks.push(price);
      if (ticks.length > 200) ticks.shift();
      allTicksRef.current.set(symbol, ticks);

      setTickCount(prev => prev + 1);

      const stats = computeDigitStats(ticks, 2);
      const sig = processTick(symbol, price, stats);
      if (sig && config.autoTrade) {
        const check = prepareTrade(sig, balance);
        if (check.willTrade) {
          handleAutoBuy();
        }
      }
    };

    if (currentTick && activeSymbol) {
      processAllTicks(activeSymbol.underlying_symbol, currentTick.quote);
    }

    return () => {};
  }, [isRunning, currentTick, activeSymbol, ws, isConnected, processTick, prepareTrade, balance, config.autoTrade, handleAutoBuy]);

  useEffect(() => {
    if (!isRunning || !ws || !isConnected || symbols.length === 0) return;
    if (subscriptionsRef.current.size > 0) return;

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
        if (result.subscriptionId) {
          subscriptionsRef.current.set(sym, result.unsubscribe);
        }
      }).catch(() => {});
    });

    return () => {};
  }, [isRunning, ws, isConnected, symbols]);

  return (
    <>
      <Button
        variant={isRunning ? 'default' : 'outline'}
        size="sm"
        onClick={() => setIsPanelOpen(true)}
        className={cn(
          "relative gap-2 h-9 px-3 font-semibold shrink-0",
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
        <span className="hidden sm:inline">AI Bot</span>
      </Button>

      {isPanelOpen && (
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
        />
      )}
    </>
  );
}
