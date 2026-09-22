'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  AIBotEngine,
  type BotActivity,
  type TradeSignal,
  type BotConfig,
  type MarketAnalysis,
  type TradeRecord,
  type DailyStats,
} from './ai-bot-engine';
import type { DigitStats } from '@/lib/types';
import { getLastDigit } from '@/lib/digit-stats';

interface UseAIBotReturn {
  isRunning: boolean;
  config: BotConfig;
  activities: BotActivity[];
  signals: TradeSignal[];
  tradeHistory: TradeRecord[];
  dailyStats: DailyStats;
  lastAnalysis: MarketAnalysis | null;
  emergencyStop: boolean;
  startBot: (symbols: string[]) => void;
  stopBot: () => void;
  updateConfig: (config: Partial<BotConfig>) => void;
  processTick: (symbol: string, price: number, digitStats: DigitStats, pipSize?: number) => TradeSignal | null;
  checkRules: (symbol: string, price: number, digitStats: DigitStats, pipSize?: number) => TradeSignal | null;
  prepareTrade: (signal: TradeSignal, balance: number) => { stake: number; willTrade: boolean; reason?: string };
  recordTradeResult: (tradeId: string, result: 'WIN' | 'LOSS', profit: number) => void;
  triggerEmergencyStop: () => void;
  resetEmergencyStop: () => void;
  clearActivities: () => void;
  clearSignals: () => void;
}

export function useAIBot(): UseAIBotReturn {
  const [isRunning, setIsRunning] = useState(false);
  const [config, setConfig] = useState<BotConfig>({
    enabled: false,
    autoTrade: true,
    stake: 1,
    targetProfit: 50,
    stopLoss: 50,
    maxTrades: 200,
    maxDailyTrades: 200,
    minConfidence: 75,
    confidenceThreshold: 75,
    minTickInterval: 1200,
    maxConsecutiveLosses: 4,
    maxDailyLoss: 100,
    maxDailyProfit: 200,
    duration: 1,
    scanInterval: 1500,
    symbols: [],
    markets: [],
    tradeTypes: ['DIGITDIFF', 'DIGITMATCH', 'DIGITOVER', 'DIGITUNDER'],
    strategies: ['over2', 'under8'],
    over2Enabled: true,
    under8Enabled: true,
    overUnderStrategy: false,
    overThreshold: 2,
    underThreshold: 8,
  });
  const [activities, setActivities] = useState<BotActivity[]>([]);
  const [signals, setSignals] = useState<TradeSignal[]>([]);
  const [tradeHistory, setTradeHistory] = useState<TradeRecord[]>([]);
  const [dailyStats, setDailyStats] = useState<DailyStats>({
    date: new Date().toISOString().split('T')[0],
    totalTrades: 0, wins: 0, losses: 0, totalProfit: 0, totalLoss: 0, netPnl: 0, dailyPnL: 0, currentStreak: 0,
  });
  const [lastAnalysis, setLastAnalysis] = useState<MarketAnalysis | null>(null);
  const [emergencyStop, setEmergencyStop] = useState(false);

  const engineRef = useRef<AIBotEngine | null>(null);
  const priceHistoryRef = useRef<Map<string, number[]>>(new Map());

  useEffect(() => {
    engineRef.current = new AIBotEngine(config);
    engineRef.current.setCallbacks({
      onActivity: (activity) => setActivities(prev => [activity, ...prev].slice(0, 500)),
      onSignal: (signal) => setSignals(prev => [signal, ...prev].slice(0, 200)),
    });
    return () => { engineRef.current?.stop(); };
  }, []);

  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.updateConfig(config);
    }
  }, [config]);

  const syncState = useCallback(() => {
    if (!engineRef.current) return;
    setTradeHistory(engineRef.current.getTradeHistory());
    setDailyStats(engineRef.current.getDailyStats());
    setEmergencyStop(engineRef.current.getEmergencyStop());
    setConfig(engineRef.current.getConfig());
  }, []);

  const startBot = useCallback((symbols: string[]) => {
    if (!engineRef.current) return;
    engineRef.current.start(symbols);
    setIsRunning(true);
    syncState();
  }, [syncState]);

  const stopBot = useCallback(() => {
    if (!engineRef.current) return;
    engineRef.current.stop();
    setIsRunning(false);
    syncState();
  }, [syncState]);

  const updateConfig = useCallback((updates: Partial<BotConfig>) => {
    setConfig(prev => {
      const newConfig = { ...prev, ...updates };
      engineRef.current?.updateConfig(newConfig);
      return newConfig;
    });
  }, []);

  const checkRules = useCallback((symbol: string, price: number, digitStats: DigitStats, pipSize: number = 2): TradeSignal | null => {
    if (!engineRef.current || !isRunning) return null;

    const history = priceHistoryRef.current.get(symbol) ?? [];
    history.push(price);
    if (history.length > 200) history.shift();
    priceHistoryRef.current.set(symbol, history);
    engineRef.current.updatePriceHistory(symbol, price, pipSize);

    const lastDigit = getLastDigit(price, pipSize);

    if (history.length >= 2) {
      const secondLastPrice = history[history.length - 2];
      const secondLastDigit = getLastDigit(secondLastPrice, pipSize);

      const under8Sig = engineRef.current.checkUnder8Rule(symbol, lastDigit, secondLastDigit, digitStats);
      if (under8Sig) { syncState(); return under8Sig; }

      const over2Sig = engineRef.current.checkOver2Rule(symbol, lastDigit, secondLastDigit, digitStats);
      if (over2Sig) { syncState(); return over2Sig; }
    }

    return null;
  }, [isRunning, syncState]);

  const processTick = useCallback((symbol: string, price: number, digitStats: DigitStats, pipSize: number = 2): TradeSignal | null => {
    if (!engineRef.current || !isRunning) return null;
    engineRef.current.updatePriceHistory(symbol, price, pipSize);
    const lastDigit = getLastDigit(price, pipSize);
    const analysis = engineRef.current.analyzeMarket(symbol, digitStats, lastDigit, price);
    setLastAnalysis(analysis);
    const signal = engineRef.current.generateSignal(analysis, 1000);
    syncState();
    return signal;
  }, [isRunning, syncState]);

  const prepareTrade = useCallback((signal: TradeSignal, balance: number) => {
    if (!engineRef.current) return { stake: 0, willTrade: false, reason: 'Engine not initialized' };
    const result = engineRef.current.prepareTrade(signal, balance);
    syncState();
    return result;
  }, [syncState]);

  const recordTradeResult = useCallback((tradeId: string, result: 'WIN' | 'LOSS', profit: number) => {
    if (!engineRef.current) return;
    engineRef.current.recordTradeResult(tradeId, result, profit);
    syncState();
  }, [syncState]);

  const triggerEmergencyStop = useCallback(() => {
    engineRef.current?.triggerEmergencyStop();
    setEmergencyStop(true);
    setConfig(engineRef.current?.getConfig() ?? config);
  }, [config]);

  const resetEmergencyStop = useCallback(() => {
    engineRef.current?.resetEmergencyStop();
    setEmergencyStop(false);
    setConfig(engineRef.current?.getConfig() ?? config);
  }, [config]);

  const clearActivities = useCallback(() => setActivities([]), []);
  const clearSignals = useCallback(() => setSignals([]), []);

  return {
    isRunning, config, activities, signals, tradeHistory, dailyStats,
    lastAnalysis, emergencyStop,
    startBot, stopBot, updateConfig, processTick, checkRules, prepareTrade,
    recordTradeResult, triggerEmergencyStop, resetEmergencyStop,
    clearActivities, clearSignals,
  };
}
