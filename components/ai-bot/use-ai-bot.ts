'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { AIBotEngine, type BotActivity, type TradeSignal, type BotConfig, type MarketAnalysis, defaultBotConfig } from './ai-bot-engine';
import type { DigitStats } from '@/lib/types';

interface UseAIBotReturn {
  isRunning: boolean;
  config: BotConfig;
  activities: BotActivity[];
  signals: TradeSignal[];
  lastAnalysis: MarketAnalysis | null;
  startBot: (symbols: string[]) => void;
  stopBot: () => void;
  updateConfig: (config: Partial<BotConfig>) => void;
  analyzeMarket: (symbol: string, digitStats: DigitStats, lastDigit: number) => MarketAnalysis | null;
  processTick: (symbol: string, price: number, digitStats: DigitStats) => TradeSignal | null;
  clearActivities: () => void;
  clearSignals: () => void;
}

export function useAIBot(): UseAIBotReturn {
  const [isRunning, setIsRunning] = useState(false);
  const [config, setConfig] = useState<BotConfig>(defaultBotConfig);
  const [activities, setActivities] = useState<BotActivity[]>([]);
  const [signals, setSignals] = useState<TradeSignal[]>([]);
  const [lastAnalysis, setLastAnalysis] = useState<MarketAnalysis | null>(null);

  const engineRef = useRef<AIBotEngine | null>(null);

  useEffect(() => {
    engineRef.current = new AIBotEngine(config);
    engineRef.current.setCallbacks({
      onActivity: (activity) => {
        setActivities((prev) => [activity, ...prev].slice(0, 200));
      },
      onSignal: (signal) => {
        setSignals((prev) => [signal, ...prev].slice(0, 100));
      },
    });

    return () => {
      engineRef.current?.stop();
    };
  }, []);

  const startBot = useCallback((symbols: string[]) => {
    if (!engineRef.current) return;
    engineRef.current.start(symbols);
    setIsRunning(true);
  }, []);

  const stopBot = useCallback(() => {
    if (!engineRef.current) return;
    engineRef.current.stop();
    setIsRunning(false);
  }, []);

  const updateConfig = useCallback((updates: Partial<BotConfig>) => {
    setConfig((prev) => {
      const newConfig = { ...prev, ...updates };
      engineRef.current?.updateConfig(newConfig);
      return newConfig;
    });
  }, []);

  const analyzeMarket = useCallback((symbol: string, digitStats: DigitStats, lastDigit: number): MarketAnalysis | null => {
    if (!engineRef.current) return null;
    const analysis = engineRef.current.analyzeMarket(symbol, digitStats, lastDigit);
    setLastAnalysis(analysis);
    return analysis;
  }, []);

  const processTick = useCallback((symbol: string, price: number, digitStats: DigitStats): TradeSignal | null => {
    if (!engineRef.current || !isRunning) return null;

    engineRef.current.updatePriceHistory(symbol, price);

    const lastDigit = parseInt(price.toFixed(2).slice(-1), 10);
    const analysis = engineRef.current.analyzeMarket(symbol, digitStats, lastDigit);
    setLastAnalysis(analysis);

    const signal = engineRef.current.generateSignal(analysis);
    return signal;
  }, [isRunning]);

  const clearActivities = useCallback(() => {
    setActivities([]);
  }, []);

  const clearSignals = useCallback(() => {
    setSignals([]);
  }, []);

  return {
    isRunning,
    config,
    activities,
    signals,
    lastAnalysis,
    startBot,
    stopBot,
    updateConfig,
    analyzeMarket,
    processTick,
    clearActivities,
    clearSignals,
  };
}
