'use client';

import { useState, useEffect, useCallback } from 'react';
import { Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AIBotPanel } from './ai-bot-panel';
import { useAIBot } from './use-ai-bot';
import { cn } from '@/lib/utils';
import type { ActiveSymbol, Tick } from '@deriv/core';
import type { DigitStats } from '@/lib/types';

interface AIBotControllerProps {
  activeSymbol: ActiveSymbol | null;
  currentTick: Tick | null;
  digitStats: DigitStats;
  symbols: ActiveSymbol[];
  balance?: number;
  isConnected?: boolean;
  onBuy?: (signal: { contractMode: string; digit?: number; stake: number }) => void;
}

export function AIBotController({
  activeSymbol,
  currentTick,
  digitStats,
  symbols,
  balance = 0,
  isConnected = false,
  onBuy,
}: AIBotControllerProps) {
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [tickCount, setTickCount] = useState(0);

  const {
    isRunning, config, activities, signals, tradeHistory, dailyStats,
    lastAnalysis, emergencyStop,
    startBot, stopBot, updateConfig, processTick, prepareTrade,
    triggerEmergencyStop, resetEmergencyStop,
  } = useAIBot();

  const handleStart = useCallback(() => {
    const volSymbols = symbols
      .filter(s => s.underlying_symbol.startsWith('Volatility'))
      .map(s => s.underlying_symbol);
    const allSymbols = volSymbols.length > 0 ? volSymbols : symbols.map(s => s.underlying_symbol);
    startBot(allSymbols);
  }, [symbols, startBot]);

  useEffect(() => {
    if (!isRunning || !currentTick || !activeSymbol) return;
    setTickCount(prev => prev + 1);
    const signal = processTick(activeSymbol.underlying_symbol, currentTick.quote, digitStats);
    if (signal && config.autoTrade) {
      const tradeCheck = prepareTrade(signal, balance);
      if (tradeCheck.willTrade && onBuy) {
        onBuy({
          contractMode: signal.contractMode,
          digit: signal.predictedDigit,
          stake: tradeCheck.stake,
        });
      }
    }
  }, [isRunning, currentTick, activeSymbol, digitStats, processTick, prepareTrade, balance, config.autoTrade, onBuy]);

  return (
    <>
      <Button
        variant={isRunning ? 'default' : 'outline'}
        size="sm"
        onClick={() => setIsPanelOpen(true)}
        className={cn(
          "relative gap-2 h-9 px-3 font-semibold",
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
