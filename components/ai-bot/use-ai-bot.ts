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
  type BacktestResult,
  type ValidationResult,
  type ProposalSnapshot,
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
  validation: ValidationResult | null;
  startBot: (symbols: string[]) => void;
  stopBot: () => void;
  updateConfig: (config: Partial<BotConfig>) => void;
  processTick: (symbol: string, price: number, digitStats: DigitStats, pipSize?: number) => TradeSignal | null;
  checkRules: (symbol: string, price: number, digitStats: DigitStats, pipSize?: number) => TradeSignal | null;
  checkEvenOdd: (symbol: string, digitStats: DigitStats) => TradeSignal | null;
  checkOver3Under6: (symbol: string, digitStats: DigitStats) => TradeSignal | null;
  prepareTrade: (signal: TradeSignal, balance: number) => { stake: number; willTrade: boolean; reason?: string };
  recordTradeResult: (tradeId: string, result: 'WIN' | 'LOSS', profit: number) => void;
  triggerEmergencyStop: () => void;
  resetEmergencyStop: () => void;
  clearActivities: () => void;
  clearSignals: () => void;
  verifyExpectedProfit: (signal: TradeSignal, proposal: ProposalSnapshot, stake: number) => { ok: boolean; reason: string; expectedValue: number; profitIfWin: number };
  isRiskAcceptable: (signal: TradeSignal, balance: number) => { ok: boolean; reason?: string };
  runBacktest: (symbol?: string) => BacktestResult | null;
  runValidation: (symbol?: string) => ValidationResult | null;
  getLastValidation: () => ValidationResult | null;
  getDrawdown: () => { current: number; max: number; peak: number };
  getStrategyHealth: () => Map<string, { enabled: boolean; suspendedReason?: string; winRate: number; trades: number; profitFactor: number }>;
  adaptParametersWithValidation: (symbol?: string) => boolean;
  runPeriodicValidation: (symbol?: string) => ValidationResult | null;
}

export function useAIBot(): UseAIBotReturn {
  const [isRunning, setIsRunning] = useState(false);
  const [config, setConfig] = useState<BotConfig>({
    enabled: false,
    autoTrade: true,
    stake: 0.7,
    targetProfit: 6,
    stopLoss: 50,
    maxTrades: 200,
    maxDailyTrades: 200,
    minConfidence: 75,
    confidenceThreshold: 75,
    minTickInterval: 1200,
    maxConsecutiveLosses: 4,
    maxDailyLoss: 50,
    maxDailyProfit: 200,
    duration: 1,
    scanInterval: 1500,
    symbols: [],
    markets: [],
    tradeTypes: ['DIGITDIFF', 'DIGITMATCH', 'DIGITOVER', 'DIGITUNDER', 'DIGITEVEN', 'DIGITODD'],
    strategies: ['over2', 'under8', 'evenOdd', 'over3under6'],
    over2Enabled: true,
    under8Enabled: true,
    overUnderStrategy: false,
    overThreshold: 2,
    underThreshold: 8,
    evenOddEnabled: true,
    evenStreakEnabled: false,
    oddStreakEnabled: false,
    over3Under6Enabled: true,
    streakLength: 3,
    splitMartingaleEnabled: true,
    splitFactor: 1,
    returnRate: 0.54,
    tradeMode: 'all',
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
  const [validation, setValidation] = useState<ValidationResult | null>(null);

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

  const checkEvenOdd = useCallback((symbol: string, digitStats: DigitStats): TradeSignal | null => {
    if (!engineRef.current || !isRunning) return null;
    const sig = engineRef.current.checkEvenOddStreak(symbol, digitStats);
    if (sig) syncState();
    return sig;
  }, [isRunning, syncState]);

  const checkOver3Under6 = useCallback((symbol: string, digitStats: DigitStats): TradeSignal | null => {
    if (!engineRef.current || !isRunning) return null;
    const sig = engineRef.current.checkOver3Under6(symbol, digitStats);
    if (sig) syncState();
    return sig;
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

  const verifyExpectedProfit = useCallback((signal: TradeSignal, proposal: ProposalSnapshot, stake: number) => {
    if (!engineRef.current) return { ok: false, reason: 'Engine not ready', expectedValue: -999, profitIfWin: 0 };
    return engineRef.current.verifyExpectedProfit(signal, proposal, stake);
  }, []);
  const isRiskAcceptable = useCallback((signal: TradeSignal, balance: number) => {
    if (!engineRef.current) return { ok: false, reason: 'Engine not ready' };
    return engineRef.current.isRiskAcceptable(signal, balance);
  }, []);
  const runBacktest = useCallback((symbol?: string) => {
    if (!engineRef.current) return null;
    const r = engineRef.current.runBacktest(symbol);
    syncState();
    return r;
  }, [syncState]);
  const runValidation = useCallback((symbol?: string) => {
    if (!engineRef.current) return null;
    const r = engineRef.current.runValidation(symbol);
    if (r) setValidation(r);
    syncState();
    return r;
  }, [syncState]);
  const getLastValidation = useCallback(() => engineRef.current?.getLastValidation() ?? null, []);
  const getDrawdown = useCallback(() => engineRef.current?.getDrawdown() ?? { current: 0, max: 0, peak: 0 }, []);
  const getStrategyHealth = useCallback(() => engineRef.current?.getStrategyHealth() ?? new Map(), []);
  const adaptParametersWithValidation = useCallback((symbol?: string) => {
    if (!engineRef.current) return false;
    const ok = engineRef.current.adaptParametersWithValidation(symbol);
    syncState();
    return ok;
  }, [syncState]);
  const runPeriodicValidation = useCallback((symbol?: string) => {
    if (!engineRef.current) return null;
    if (!engineRef.current.shouldRunPeriodicValidation()) return engineRef.current.getLastValidation();
    const r = engineRef.current.runPeriodicValidation(symbol);
    if (r) setValidation(r);
    // Try disciplined adaptation only when supported by OOS gain
    engineRef.current.adaptParametersWithValidation(symbol);
    syncState();
    return r;
  }, [syncState]);

  return {
    isRunning, config, activities, signals, tradeHistory, dailyStats,
    lastAnalysis, emergencyStop, validation,
    startBot, stopBot, updateConfig, processTick, checkRules, checkEvenOdd, checkOver3Under6, prepareTrade,
    recordTradeResult, triggerEmergencyStop, resetEmergencyStop,
    clearActivities, clearSignals,
    verifyExpectedProfit, isRiskAcceptable, runBacktest, runValidation, getLastValidation, getDrawdown,
    getStrategyHealth, adaptParametersWithValidation, runPeriodicValidation,
  };
}
