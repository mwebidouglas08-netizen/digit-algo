'use client';

import type { DigitStats, ContractMode } from '@/lib/types';

export type SignalType = 'STRONG_BUY' | 'BUY' | 'NEUTRAL' | 'SELL' | 'STRONG_SELL';

export interface TradeSignal {
  id: string;
  timestamp: number;
  symbol: string;
  signalType: SignalType;
  confidence: number;
  contractMode: ContractMode;
  predictedDigit?: number;
  reasoning: string[];
  priceAtSignal: number;
  expectedPayout: number;
}

export interface BotActivity {
  id: string;
  timestamp: number;
  type: 'SCAN' | 'ANALYSIS' | 'SIGNAL' | 'TRADE' | 'RESULT' | 'ERROR' | 'INFO';
  message: string;
  details?: Record<string, unknown>;
}

export interface BotConfig {
  enabled: boolean;
  autoTrade: boolean;
  minConfidence: number;
  maxStake: number;
  stakePercentage: number;
  scanInterval: number;
  symbols: string[];
  tradeTypes: ContractMode[];
}

export interface MarketAnalysis {
  symbol: string;
  lastDigit: number;
  digitStats: DigitStats;
  patterns: PatternResult[];
  streaks: StreakInfo;
  volatility: number;
  trend: TrendInfo;
  timestamp: number;
}

interface PatternResult {
  type: string;
  confidence: number;
  description: string;
  predictedNext?: number;
}

interface StreakInfo {
  currentDigit: number;
  streakLength: number;
  isBreaking: boolean;
}

interface TrendInfo {
  direction: 'RISING' | 'FALLING' | 'SIDEWAYS';
  strength: number;
  recentAverage: number;
  historicalAverage: number;
}

const generateId = (): string => Math.random().toString(36).substring(2, 11);

export class AIBotEngine {
  private config: BotConfig;
  private activities: BotActivity[] = [];
  private signals: TradeSignal[] = [];
  private priceHistory: Map<string, number[]> = new Map();
  private lastAnalysis: Map<string, MarketAnalysis> = new Map();
  private scanTimer: ReturnType<typeof setInterval> | null = null;
  private onActivity: ((activity: BotActivity) => void) | null = null;
  private onSignal: ((signal: TradeSignal) => void) | null = null;
  private onTrade: ((trade: { signal: TradeSignal; stake: number }) => void) | null = null;

  constructor(config?: Partial<BotConfig>) {
    this.config = {
      enabled: false,
      autoTrade: false,
      minConfidence: 75,
      maxStake: 50,
      stakePercentage: 2,
      scanInterval: 3000,
      symbols: [],
      tradeTypes: ['DIGITMATCH', 'DIGITDIFF', 'DIGITOVER', 'DIGITUNDER'],
      ...config,
    };
  }

  setCallbacks(callbacks: {
    onActivity?: (activity: BotActivity) => void;
    onSignal?: (signal: TradeSignal) => void;
    onTrade?: (trade: { signal: TradeSignal; stake: number }) => void;
  }) {
    this.onActivity = callbacks.onActivity ?? null;
    this.onSignal = callbacks.onSignal ?? null;
    this.onTrade = callbacks.onTrade ?? null;
  }

  updateConfig(updates: Partial<BotConfig>) {
    this.config = { ...this.config, ...updates };
  }

  getConfig(): BotConfig {
    return { ...this.config };
  }

  getActivities(): BotActivity[] {
    return [...this.activities];
  }

  getSignals(): TradeSignal[] {
    return [...this.signals];
  }

  private addActivity(activity: Omit<BotActivity, 'id' | 'timestamp'>) {
    const fullActivity: BotActivity = {
      ...activity,
      id: generateId(),
      timestamp: Date.now(),
    };
    this.activities = [fullActivity, ...this.activities].slice(0, 200);
    this.onActivity?.(fullActivity);
  }

  updatePriceHistory(symbol: string, price: number) {
    const history = this.priceHistory.get(symbol) ?? [];
    history.push(price);
    if (history.length > 500) {
      history.shift();
    }
    this.priceHistory.set(symbol, history);
  }

  start(symbols: string[]) {
    if (this.config.enabled) return;
    this.config.enabled = true;
    this.config.symbols = symbols;
    this.addActivity({
      type: 'INFO',
      message: `AI Bot started. Monitoring ${symbols.length} symbols.`,
      details: { symbols },
    });
  }

  stop() {
    this.config.enabled = false;
    if (this.scanTimer) {
      clearInterval(this.scanTimer);
      this.scanTimer = null;
    }
    this.addActivity({
      type: 'INFO',
      message: 'AI Bot stopped.',
    });
  }

  analyzeMarket(symbol: string, digitStats: DigitStats, lastDigit: number): MarketAnalysis {
    const history = this.priceHistory.get(symbol) ?? [];
    const patterns = this.detectPatterns(symbol, history, digitStats);
    const streaks = this.analyzeStreaks(symbol, history);
    const volatility = this.calculateVolatility(history);
    const trend = this.analyzeTrend(history, digitStats);

    const analysis: MarketAnalysis = {
      symbol,
      lastDigit,
      digitStats,
      patterns,
      streaks,
      volatility,
      trend,
      timestamp: Date.now(),
    };

    this.lastAnalysis.set(symbol, analysis);
    return analysis;
  }

  generateSignal(analysis: MarketAnalysis): TradeSignal | null {
    const { symbol, digitStats, patterns, streaks, volatility, trend, lastDigit } = analysis;

    if (digitStats.totalTicks < 20) {
      this.addActivity({
        type: 'SCAN',
        message: `${symbol}: Insufficient data (${digitStats.totalTicks} ticks). Need more data.`,
      });
      return null;
    }

    const reasons: string[] = [];
    let confidence = 50;
    let signalType: SignalType = 'NEUTRAL';
    let contractMode: ContractMode = 'DIGITMATCH';
    let predictedDigit: number | undefined;

    const highestDigit = digitStats.percentages.indexOf(Math.max(...digitStats.percentages));
    const lowestDigit = digitStats.percentages.indexOf(Math.min(...digitStats.percentages));
    const highestPct = digitStats.percentages[highestDigit];
    const lowestPct = digitStats.percentages[lowestDigit];

    if (highestPct > 15) {
      confidence += 10;
      reasons.push(`Digit ${highestDigit} appears frequently (${highestPct.toFixed(1)}%)`);
    }

    if (lowestPct < 5) {
      confidence += 8;
      reasons.push(`Digit ${lowestDigit} is rare (${lowestPct.toFixed(1)}%)`);
    }

    for (const pattern of patterns) {
      if (pattern.confidence > 60) {
        confidence += pattern.confidence * 0.15;
        reasons.push(pattern.description);
        if (pattern.predictedNext !== undefined) {
          predictedDigit = pattern.predictedNext;
        }
      }
    }

    if (streaks.streakLength >= 3 && streaks.isBreaking) {
      confidence += 12;
      reasons.push(`${streaks.streakLength}-digit streak detected, likely reversal`);
    }

    if (volatility > 3) {
      confidence -= 5;
      reasons.push('High volatility detected - caution advised');
    } else if (volatility < 1.5) {
      confidence += 5;
      reasons.push('Low volatility - stable pattern');
    }

    if (trend.strength > 70) {
      confidence += 8;
      reasons.push(`Strong ${trend.direction.toLowerCase()} trend detected`);
    }

    if (confidence >= this.config.minConfidence) {
      if (predictedDigit !== undefined) {
        contractMode = 'DIGITMATCH';
        signalType = confidence >= 85 ? 'STRONG_BUY' : 'BUY';
        reasons.push(`Predicted next digit: ${predictedDigit}`);
      } else {
        contractMode = 'DIGITDIFF';
        signalType = confidence >= 85 ? 'STRONG_BUY' : 'BUY';
        reasons.push(`Predicting digit will differ from recent pattern`);
      }
    } else if (confidence >= 60) {
      signalType = 'NEUTRAL';
    } else {
      signalType = confidence < 40 ? 'STRONG_SELL' : 'SELL';
      reasons.push('Low confidence - not recommended to trade');
    }

    if (signalType === 'NEUTRAL') {
      this.addActivity({
        type: 'ANALYSIS',
        message: `${symbol}: Neutral signal (${confidence.toFixed(1)}% confidence)`,
        details: { confidence, reasons },
      });
      return null;
    }

    const signal: TradeSignal = {
      id: generateId(),
      timestamp: Date.now(),
      symbol,
      signalType,
      confidence: Math.min(99, Math.max(0, confidence)),
      contractMode,
      predictedDigit,
      reasoning: reasons,
      priceAtSignal: analysis.lastDigit,
      expectedPayout: 0,
    };

    this.signals = [signal, ...this.signals].slice(0, 100);
    this.onSignal?.(signal);

    this.addActivity({
      type: 'SIGNAL',
      message: `${symbol}: ${signalType} signal with ${signal.confidence.toFixed(1)}% confidence`,
      details: { signal },
    });

    return signal;
  }

  executeTrade(signal: TradeSignal, balance: number): { stake: number; willTrade: boolean } {
    if (!this.config.autoTrade) {
      this.addActivity({
        type: 'INFO',
        message: `Auto-trade disabled. Signal detected for ${signal.symbol} but not executing.`,
      });
      return { stake: 0, willTrade: false };
    }

    if (signal.confidence < this.config.minConfidence) {
      this.addActivity({
        type: 'INFO',
        message: `Confidence ${signal.confidence.toFixed(1)}% below threshold ${this.config.minConfidence}%. Skipping.`,
      });
      return { stake: 0, willTrade: false };
    }

    const stake = Math.min(
      this.config.maxStake,
      Math.max(1, balance * (this.config.stakePercentage / 100))
    );

    this.addActivity({
      type: 'TRADE',
      message: `Executing ${signal.contractMode} trade on ${signal.symbol} with $${stake.toFixed(2)} stake`,
      details: { signal, stake, balance },
    });

    this.onTrade?.({ signal, stake });

    return { stake, willTrade: true };
  }

  private detectPatterns(symbol: string, history: number[], stats: DigitStats): PatternResult[] {
    const patterns: PatternResult[] = [];
    if (history.length < 30) return patterns;

    const recent = history.slice(-20);
    const digitSequence = recent.map((p) => {
      const str = p.toFixed(2);
      return parseInt(str[str.length - 1], 10);
    });

    const consecutiveSame = this.findConsecutivePattern(digitSequence);
    if (consecutiveSame) {
      patterns.push({
        type: 'CONSECUTIVE',
        confidence: 65,
        description: `Consecutive pattern detected: ${consecutiveSame.description}`,
        predictedNext: consecutiveSame.predicted,
      });
    }

    const alternating = this.findAlternatingPattern(digitSequence);
    if (alternating) {
      patterns.push({
        type: 'ALTERNATING',
        confidence: 60,
        description: `Alternating pattern: ${alternating.description}`,
      });
    }

    const cyclic = this.findCyclicPattern(digitSequence);
    if (cyclic) {
      patterns.push({
        type: 'CYCLIC',
        confidence: 70,
        description: `Cyclic pattern detected: ${cyclic.description}`,
        predictedNext: cyclic.predicted,
      });
    }

    const hotspot = this.findHotColdDigits(stats);
    if (hotspot) {
      patterns.push({
        type: 'HOTSPOT',
        confidence: 55,
        description: hotspot.description,
        predictedNext: hotspot.predicted,
      });
    }

    const overdue = this.findOverdueDigits(stats);
    if (overdue) {
      patterns.push({
        type: 'OVERDUE',
        confidence: 50,
        description: overdue.description,
        predictedNext: overdue.predicted,
      });
    }

    return patterns;
  }

  private findConsecutivePattern(sequence: number[]): { description: string; predicted?: number } | null {
    if (sequence.length < 5) return null;

    let maxRun = 1;
    let currentRun = 1;
    let runDigit = sequence[0];

    for (let i = 1; i < sequence.length; i++) {
      if (sequence[i] === sequence[i - 1]) {
        currentRun++;
        if (currentRun > maxRun) {
          maxRun = currentRun;
          runDigit = sequence[i];
        }
      } else {
        currentRun = 1;
      }
    }

    if (maxRun >= 3) {
      return {
        description: `${maxRun} consecutive ${runDigit}s`,
        predicted: runDigit,
      };
    }

    return null;
  }

  private findAlternatingPattern(sequence: number[]): { description: string } | null {
    if (sequence.length < 6) return null;

    let alternatingCount = 0;
    for (let i = 2; i < Math.min(10, sequence.length); i++) {
      if (sequence[i] === sequence[i - 2]) {
        alternatingCount++;
      }
    }

    if (alternatingCount >= 3) {
      return {
        description: `Alternating pattern between digits`,
      };
    }

    return null;
  }

  private findCyclicPattern(sequence: number[]): { description: string; predicted?: number } | null {
    if (sequence.length < 15) return null;

    for (let cycleLen = 2; cycleLen <= 5; cycleLen++) {
      let matches = 0;
      const totalChecks = Math.floor((sequence.length - cycleLen) / cycleLen);

      for (let i = 0; i < totalChecks; i++) {
        const pos = sequence.length - 1 - (i + 1) * cycleLen;
        if (pos >= 0 && sequence[pos] === sequence[pos + cycleLen]) {
          matches++;
        }
      }

      if (totalChecks > 0 && matches / totalChecks > 0.7) {
        const predicted = sequence[sequence.length - cycleLen];
        return {
          description: `Cyclic pattern with period ${cycleLen}`,
          predicted,
        };
      }
    }

    return null;
  }

  private findHotColdDigits(stats: DigitStats): { description: string; predicted?: number } | null {
    if (stats.totalTicks < 30) return null;

    const avg = 10;
    const hotDigits: number[] = [];
    const coldDigits: number[] = [];

    for (let i = 0; i < 10; i++) {
      if (stats.percentages[i] > avg + 3) {
        hotDigits.push(i);
      } else if (stats.percentages[i] < avg - 3) {
        coldDigits.push(i);
      }
    }

    if (hotDigits.length > 0) {
      return {
        description: `Hot digits: ${hotDigits.join(', ')}`,
        predicted: hotDigits[0],
      };
    }

    if (coldDigits.length > 0) {
      return {
        description: `Cold digits (overdue): ${coldDigits.join(', ')}`,
        predicted: coldDigits[0],
      };
    }

    return null;
  }

  private findOverdueDigits(stats: DigitStats): { description: string; predicted?: number } | null {
    if (stats.totalTicks < 50) return null;

    const expected = 10;
    const overdue: { digit: number; deficit: number }[] = [];

    for (let i = 0; i < 10; i++) {
      const actual = stats.percentages[i];
      const deficit = expected - actual;
      if (deficit > 3) {
        overdue.push({ digit: i, deficit });
      }
    }

    if (overdue.length > 0) {
      overdue.sort((a, b) => b.deficit - a.deficit);
      return {
        description: `Overdue digits: ${overdue.map((d) => d.digit).join(', ')}`,
        predicted: overdue[0].digit,
      };
    }

    return null;
  }

  private analyzeStreaks(symbol: string, history: number[]): StreakInfo {
    if (history.length === 0) {
      return { currentDigit: 0, streakLength: 0, isBreaking: false };
    }

    const lastPrice = history[history.length - 1];
    const lastDigit = parseInt(lastPrice.toFixed(2).slice(-1), 10);

    let streakLength = 1;
    for (let i = history.length - 2; i >= 0; i--) {
      const digit = parseInt(history[i].toFixed(2).slice(-1), 10);
      if (digit === lastDigit) {
        streakLength++;
      } else {
        break;
      }
    }

    const isBreaking = history.length >= 2 &&
      parseInt(history[history.length - 2].toFixed(2).slice(-1), 10) !== lastDigit &&
      streakLength === 1;

    return { currentDigit: lastDigit, streakLength, isBreaking };
  }

  private calculateVolatility(history: number[]): number {
    if (history.length < 10) return 0;

    const recent = history.slice(-20);
    const changes: number[] = [];

    for (let i = 1; i < recent.length; i++) {
      changes.push(Math.abs(recent[i] - recent[i - 1]));
    }

    const avg = changes.reduce((a, b) => a + b, 0) / changes.length;
    return avg;
  }

  private analyzeTrend(history: number[], stats: DigitStats): TrendInfo {
    if (history.length < 20) {
      return { direction: 'SIDEWAYS', strength: 0, recentAverage: 0, historicalAverage: 0 };
    }

    const recent = history.slice(-10);
    const older = history.slice(-20, -10);

    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const olderAvg = older.length > 0 ? older.reduce((a, b) => a + b, 0) / older.length : recentAvg;

    const diff = recentAvg - olderAvg;
    const avgPrice = history.reduce((a, b) => a + b, 0) / history.length;
    const normalizedDiff = Math.abs(diff) / avgPrice * 100;

    let direction: 'RISING' | 'FALLING' | 'SIDEWAYS';
    if (diff > 0.01) {
      direction = 'RISING';
    } else if (diff < -0.01) {
      direction = 'FALLING';
    } else {
      direction = 'SIDEWAYS';
    }

    return {
      direction,
      strength: Math.min(100, normalizedDiff * 10),
      recentAverage: recentAvg,
      historicalAverage: olderAvg,
    };
  }
}

export const defaultBotConfig: BotConfig = {
  enabled: false,
  autoTrade: false,
  minConfidence: 75,
  maxStake: 50,
  stakePercentage: 2,
  scanInterval: 3000,
  symbols: [],
  tradeTypes: ['DIGITMATCH', 'DIGITDIFF', 'DIGITOVER', 'DIGITUNDER'],
};
