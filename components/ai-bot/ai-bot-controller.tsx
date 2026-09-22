'use client';

import { useState, useEffect, useCallback } from 'react';
import { Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AIBotPanel } from './ai-bot-panel';
import { useAIBot } from './use-ai-bot';
import { useDerivWSContext } from '@/components/custom/deriv-ws-provider';
import type { ActiveSymbol, Tick } from '@deriv/core';
import type { DigitStats } from '@/lib/types';
import { cn } from '@/lib/utils';

interface AIBotControllerProps {
  activeSymbol: ActiveSymbol | null;
  currentTick: Tick | null;
  digitStats: DigitStats;
  symbols: ActiveSymbol[];
  balance?: number;
}

export function AIBotController({
  activeSymbol,
  currentTick,
  digitStats,
  symbols,
  balance = 0,
}: AIBotControllerProps) {
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const { ws, isConnected } = useDerivWSContext();
  
  const {
    isRunning,
    config,
    activities,
    signals,
    lastAnalysis,
    startBot,
    stopBot,
    updateConfig,
    processTick,
  } = useAIBot();

  const handleStart = useCallback(() => {
    const symbolNames = symbols.map((s) => s.underlying_symbol);
    startBot(symbolNames);
  }, [symbols, startBot]);

  const handleStop = useCallback(() => {
    stopBot();
  }, [stopBot]);

  useEffect(() => {
    if (!isRunning || !activeSymbol || !currentTick) return;

    processTick(
      activeSymbol.underlying_symbol,
      currentTick.quote,
      digitStats
    );
  }, [isRunning, activeSymbol, currentTick, digitStats, processTick]);

  return (
    <>
      <Button
        variant={isRunning ? 'default' : 'outline'}
        size="sm"
        onClick={() => setIsPanelOpen(true)}
        className={cn(
          "relative gap-2",
          isRunning && "bg-emerald-500 hover:bg-emerald-600 text-white"
        )}
      >
        {isRunning && (
          <span className="absolute -top-1 -right-1 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
          </span>
        )}
        <Zap className="h-4 w-4" />
        <span className="hidden sm:inline">AI Bot</span>
      </Button>

      <AIBotPanel
        isOpen={isPanelOpen}
        onClose={() => setIsPanelOpen(false)}
        isRunning={isRunning}
        config={config}
        activities={activities}
        signals={signals}
        lastAnalysis={lastAnalysis}
        onStart={handleStart}
        onStop={handleStop}
        onUpdateConfig={updateConfig}
        balance={balance}
      />
    </>
  );
}
