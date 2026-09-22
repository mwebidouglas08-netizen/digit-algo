'use client';

import type { DigitStats, ContractMode } from '@/lib/types';
import { getLastDigit } from '@/lib/digit-stats';

export type SignalType = 'STRONG_BUY' | 'BUY' | 'NEUTRAL' | 'WAIT' | 'SELL' | 'STRONG_SELL';
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';

export interface TradeSignal {
  id: string;
  timestamp: number;
  symbol: string;
  signalType: SignalType;
  confidence: number;
  contractMode: ContractMode;
  predictedDigit?: number;
  direction: string;
  currentTick: number;
  recentTicks: number[];
  reasoning: string[];
  indicators: SignalIndicator[];
  riskLevel: RiskLevel;
  recommendedStake: number;
  reasonForEntry: string;
  reasonForRejection?: string;
  marketCondition?: string;
  type?: string;
}

export interface SignalIndicator {
  name: string;
  value: string;
  bullish: boolean;
}

export interface BotActivity {
  id: string;
  timestamp: number;
  type: 'SCAN' | 'ANALYSIS' | 'SIGNAL' | 'TRADE' | 'RESULT' | 'ERROR' | 'INFO' | 'WARNING';
  message: string;
  details?: Record<string, unknown>;
}

export interface TradeRecord {
  id: string;
  timestamp: number;
  symbol: string;
  contractMode: ContractMode;
  signalConfidence: number;
  stake: number;
  result: 'WIN' | 'LOSS' | 'PENDING' | 'REJECTED' | 'CANCELLED';
  profit: number;
  reason: string;
  signalType: SignalType;
  riskLevel: RiskLevel;
  digit?: number;
}

export interface DailyStats {
  date: string;
  totalTrades: number;
  wins: number;
  losses: number;
  totalProfit: number;
  totalLoss: number;
  netPnl: number;
  dailyPnL: number;
  currentStreak: number;
}

export interface BotConfig {
  enabled: boolean;
  autoTrade: boolean;
  stake: number;
  targetProfit: number;
  stopLoss: number;
  maxTrades: number;
  maxDailyTrades: number;
  minConfidence: number;
  confidenceThreshold: number;
  minTickInterval: number;
  maxConsecutiveLosses: number;
  maxDailyLoss: number;
  maxDailyProfit: number;
  duration: number;
  scanInterval: number;
  symbols: string[];
  markets: string[];
  tradeTypes: ContractMode[];
  strategies: string[];
  over2Enabled: boolean;
  under8Enabled: boolean;
  overUnderStrategy: boolean;
  overThreshold: number;
  underThreshold: number;
}

export interface MarketAnalysis {
  symbol: string;
  lastDigit: number;
  lastPrice: number;
  digitStats: DigitStats;
  patterns: PatternResult[];
  streaks: StreakInfo;
  volatility: number;
  trend: TrendInfo;
  chiSquare: number;
  entropy: number;
  zScore: number;
  overUnderSignal: OverUnderSignal | null;
  timestamp: number;
  dominantDigit: number;
  digitFrequencies: [number, number][];
}

export interface PatternResult {
  type: string;
  confidence: number;
  description: string;
  predictedNext?: number;
}

export interface StreakInfo {
  currentDigit: number;
  streakLength: number;
  isBreaking: boolean;
  longestStreak: number;
}

export interface TrendInfo {
  direction: 'RISING' | 'FALLING' | 'SIDEWAYS';
  strength: number;
  recentAverage: number;
  historicalAverage: number;
}

export interface OverUnderSignal {
  type: 'OVER_2' | 'UNDER_8';
  confidence: number;
  digitFrequency: number;
  reason: string;
}

const generateId = (): string => Math.random().toString(36).substring(2, 11);

const DEFAULT_CONFIG: BotConfig = {
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
};

export class AIBotEngine {
  private config: BotConfig;
  private activities: BotActivity[] = [];
  private signals: TradeSignal[] = [];
  private tradeHistory: TradeRecord[] = [];
  private priceHistory: Map<string, number[]> = new Map();
  private pipSizeMap: Map<string, number> = new Map();
  private lastAnalysis: Map<string, MarketAnalysis> = new Map();
  private lastTradeTime = 0;
  private consecutiveLosses = 0;
  private dailyStats: DailyStats;
  private emergencyStop = false;
  private onActivity: ((activity: BotActivity) => void) | null = null;
  private onSignal: ((signal: TradeSignal) => void) | null = null;

  constructor(config?: Partial<BotConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.dailyStats = this.getEmptyDailyStats();
  }

  private getEmptyDailyStats(): DailyStats {
    return {
      date: new Date().toISOString().split('T')[0],
      totalTrades: 0, wins: 0, losses: 0,
      totalProfit: 0, totalLoss: 0, netPnl: 0,
      dailyPnL: 0, currentStreak: 0,
    };
  }

  private resetDailyIfNeeded() {
    const today = new Date().toISOString().split('T')[0];
    if (this.dailyStats.date !== today) {
      this.dailyStats = this.getEmptyDailyStats();
    }
  }

  setCallbacks(callbacks: {
    onActivity?: (activity: BotActivity) => void;
    onSignal?: (signal: TradeSignal) => void;
  }) {
    this.onActivity = callbacks.onActivity ?? null;
    this.onSignal = callbacks.onSignal ?? null;
  }

  updateConfig(updates: Partial<BotConfig>) {
    this.config = { ...this.config, ...updates };
    if (updates.confidenceThreshold !== undefined) this.config.minConfidence = updates.confidenceThreshold;
    if (updates.minConfidence !== undefined) this.config.confidenceThreshold = updates.minConfidence;
    if (updates.maxDailyTrades !== undefined) this.config.maxTrades = updates.maxDailyTrades;
    if (updates.maxTrades !== undefined) this.config.maxDailyTrades = updates.maxTrades;
    if (updates.markets !== undefined) this.config.symbols = updates.markets;
    if (updates.symbols !== undefined) this.config.markets = updates.symbols;
  }

  getConfig(): BotConfig { return { ...this.config }; }
  getActivities(): BotActivity[] { return [...this.activities]; }
  getSignals(): TradeSignal[] { return [...this.signals]; }
  getTradeHistory(): TradeRecord[] { return [...this.tradeHistory]; }
  getDailyStats(): DailyStats { this.resetDailyIfNeeded(); return { ...this.dailyStats }; }
  getEmergencyStop(): boolean { return this.emergencyStop; }

  triggerEmergencyStop() {
    this.emergencyStop = true;
    this.config.autoTrade = false;
    this.addActivity({ type: 'WARNING', message: 'EMERGENCY STOP activated. All auto-trading halted.' });
  }

  resetEmergencyStop() {
    this.emergencyStop = false;
    this.consecutiveLosses = 0;
    this.addActivity({ type: 'INFO', message: 'Emergency stop reset. Bot can resume.' });
  }

  private addActivity(activity: Omit<BotActivity, 'id' | 'timestamp'>) {
    const full: BotActivity = { ...activity, id: generateId(), timestamp: Date.now() };
    this.activities = [full, ...this.activities].slice(0, 500);
    this.onActivity?.(full);
  }

  updatePriceHistory(symbol: string, price: number, pipSize?: number) {
    const h = this.priceHistory.get(symbol) ?? [];
    h.push(price);
    if (h.length > 1000) h.shift();
    this.priceHistory.set(symbol, h);
    if (pipSize !== undefined) this.pipSizeMap.set(symbol, pipSize);
  }

  private getPipSize(symbol: string): number {
    return this.pipSizeMap.get(symbol) ?? 2;
  }

  private getDigit(symbol: string, price: number): number {
    return getLastDigit(price, this.getPipSize(symbol));
  }

  // Adaptive: recent win-rate per contractMode — bot learns which pattern is currently profitable
  private getStrategyStats() {
    const last20 = this.tradeHistory.filter(t => t.result !== 'PENDING').slice(0, 20);
    if (last20.length < 5) return null;
    const wins = last20.filter(t => t.result === 'WIN').length;
    const winRate = wins / last20.length;
    const byMode: Record<string, { wins: number; total: number }> = {};
    for (const t of last20) {
      const m = t.contractMode;
      if (!byMode[m]) byMode[m] = { wins: 0, total: 0 };
      byMode[m].total++;
      if (t.result === 'WIN') byMode[m].wins++;
    }
    return { winRate, byMode, count: last20.length };
  }

  private isFavourableMarket(analysis: MarketAnalysis): boolean {
    // Favourable = low entropy (skewed) OR strong digit deviation OR clear over/under momentum
    // Unfavourable = high entropy ~3.32 with no deviation = random walk, skip
    if (analysis.entropy > 3.28 && Math.abs(analysis.chiSquare) < 5) return false;
    if (analysis.volatility > 0.02) return false; // too wild, payouts slip
    return true;
  }

  start(symbols: string[]) {
    if (this.config.enabled) return;
    this.emergencyStop = false;
    this.config.enabled = true;
    this.config.symbols = symbols;
    this.consecutiveLosses = 0;
    this.resetDailyIfNeeded();
    this.addActivity({
      type: 'INFO',
      message: `AI Bot started. Monitoring ${symbols.length} symbols: ${symbols.join(', ')}`,
    });
  }

  stop() {
    this.config.enabled = false;
    this.addActivity({
      type: 'INFO',
      message: `AI Bot stopped. Stats: ${this.dailyStats.totalTrades} trades, PnL: $${this.dailyStats.netPnl.toFixed(2)}`,
    });
  }

  recordTradeResult(tradeId: string, result: 'WIN' | 'LOSS', profit: number) {
    const trade = this.tradeHistory.find(t => t.id === tradeId);
    if (trade) { trade.result = result; trade.profit = profit; }
    this.resetDailyIfNeeded();
    this.dailyStats.totalTrades++;
    if (result === 'WIN') {
      this.dailyStats.wins++;
      this.dailyStats.totalProfit += profit;
      this.consecutiveLosses = 0;
      this.dailyStats.currentStreak = this.dailyStats.currentStreak >= 0 ? this.dailyStats.currentStreak + 1 : 1;
    } else {
      this.dailyStats.losses++;
      this.dailyStats.totalLoss += Math.abs(profit);
      this.consecutiveLosses++;
      this.dailyStats.currentStreak = this.dailyStats.currentStreak <= 0 ? this.dailyStats.currentStreak - 1 : -1;
    }
    this.dailyStats.netPnl = this.dailyStats.totalProfit - this.dailyStats.totalLoss;
    this.dailyStats.dailyPnL = this.dailyStats.netPnl;

    this.addActivity({
      type: 'RESULT',
      message: `Trade ${result}: $${profit.toFixed(2)} | Streak: ${this.dailyStats.currentStreak} | Daily PnL: $${this.dailyStats.netPnl.toFixed(2)}`,
    });

    if (this.consecutiveLosses >= this.config.maxConsecutiveLosses) {
      this.config.autoTrade = false;
      this.addActivity({ type: 'WARNING', message: `Auto-trade PAUSED: ${this.consecutiveLosses} consecutive losses — press Reset to resume continuous trading.` });
    }
    if (this.dailyStats.netPnl <= -this.config.maxDailyLoss) {
      this.config.autoTrade = false;
      this.addActivity({ type: 'WARNING', message: `Auto-trade PAUSED: Daily loss limit $${this.config.maxDailyLoss} reached — capital protection.` });
    }
    // Continuous mode: profit target does NOT pause — bot keeps trading until you stop it
    if (this.dailyStats.netPnl >= this.config.maxDailyProfit) {
      this.addActivity({ type: 'INFO', message: `Daily profit target $${this.config.maxDailyProfit} reached — continuing (continuous mode). PnL: $${this.dailyStats.netPnl.toFixed(2)}` });
    }
  }

  canTrade(): { allowed: boolean; reason?: string } {
    if (this.emergencyStop) return { allowed: false, reason: 'Emergency stop active' };
    if (!this.config.autoTrade) return { allowed: false, reason: 'Auto-trade disabled' };
    if (!this.config.enabled) return { allowed: false, reason: 'Bot not running' };
    if (Date.now() - this.lastTradeTime < this.config.minTickInterval) return { allowed: false, reason: 'Cooldown active' };
    if (this.dailyStats.totalTrades >= this.config.maxTrades) return { allowed: false, reason: 'Max daily trades reached' };
    if (this.consecutiveLosses >= this.config.maxConsecutiveLosses) return { allowed: false, reason: 'Max consecutive losses reached' };
    if (this.dailyStats.netPnl <= -this.config.maxDailyLoss) return { allowed: false, reason: 'Daily loss limit reached' };
    // Do not block on profit — continuous mode runs until you press Stop
    return { allowed: true };
  }

  checkOver2Rule(symbol: string, lastDigit: number, secondLastDigit: number, digitStats: DigitStats): TradeSignal | null {
    if (!this.config.over2Enabled) return null;
    if (lastDigit > 2 || secondLastDigit > 2) return null;

    const history = this.priceHistory.get(symbol) ?? [];
    const pip = this.getPipSize(symbol);
    const recentDigits = history.slice(-10).map(p => getLastDigit(p, pip));
    const lowCount = recentDigits.filter(d => d <= 2).length;
    const veryLowCount = recentDigits.filter(d => d <= 1).length;

    let confidence = 75;
    if (veryLowCount >= 2 && lowCount >= 4) confidence = 92;
    else if (veryLowCount >= 2 && lowCount >= 3) confidence = 88;
    else if (lastDigit <= 1 && secondLastDigit <= 1) confidence = 88;
    else if (lastDigit <= 2 && secondLastDigit <= 2) confidence = 78;

    const stake = Math.min(this.config.stake, this.config.stake);
    const recentTicks = history.slice(-10);
    const reasons = [`Over 2: Last two digits ${secondLastDigit}, ${lastDigit}. ${lowCount} of last ${recentDigits.length} digits are ≤ 2`];

    const signal: TradeSignal = {
      id: generateId(),
      timestamp: Date.now(),
      symbol,
      signalType: confidence >= 85 ? 'STRONG_BUY' : 'BUY',
      confidence,
      contractMode: 'DIGITOVER',
      predictedDigit: this.config.overThreshold,
      direction: `Over ${this.config.overThreshold}`,
      currentTick: recentTicks[recentTicks.length - 1] ?? 0,
      recentTicks,
      reasoning: reasons,
      indicators: [
        { name: 'Over 2 Rule', value: `${secondLastDigit}, ${lastDigit}`, bullish: true },
        { name: 'Low Digits', value: `${lowCount}/${recentDigits.length}`, bullish: true },
      ],
      riskLevel: confidence >= 85 ? 'LOW' : 'MEDIUM',
      recommendedStake: stake,
      reasonForEntry: reasons[0],
      marketCondition: 'Rule-based Over 2',
      type: 'DIGITOVER',
    };

    this.signals = [signal, ...this.signals].slice(0, 200);
    this.onSignal?.(signal);
    this.addActivity({ type: 'SIGNAL', message: `${symbol}: OVER 2 | Digits ${secondLastDigit}, ${lastDigit} | ${lowCount}/${recentDigits.length} low | ${confidence}% confidence` });
    return signal;
  }

  checkUnder8Rule(symbol: string, lastDigit: number, secondLastDigit: number, digitStats: DigitStats): TradeSignal | null {
    if (!this.config.under8Enabled) return null;
    if (lastDigit < 7 || secondLastDigit < 7) return null;

    const history = this.priceHistory.get(symbol) ?? [];
    const pip = this.getPipSize(symbol);
    const recentDigits = history.slice(-10).map(p => getLastDigit(p, pip));
    const highCount = recentDigits.filter(d => d >= 7).length;
    const veryHighCount = recentDigits.filter(d => d >= 8).length;

    const digit8Pct = digitStats.percentages[8] ?? 0;
    const digit9Pct = digitStats.percentages[9] ?? 0;
    const combinedPct = digit8Pct + digit9Pct;

    let confidence = 75;
    if (veryHighCount >= 2 && highCount >= 4 && combinedPct < 10) confidence = 93;
    else if (veryHighCount >= 2 && highCount >= 3 && combinedPct < 12) confidence = 88;
    else if (lastDigit >= 8 && secondLastDigit >= 8 && combinedPct < 10) confidence = 85;
    else if (lastDigit >= 7 && secondLastDigit >= 7 && combinedPct < 12) confidence = 80;

    if (combinedPct >= 15) return null;

    const stake = Math.min(this.config.stake, this.config.stake);
    const recentTicks = history.slice(-10);
    const reasons = [`Under 8: Last two digits ${secondLastDigit}, ${lastDigit}. ${highCount} of last ${recentDigits.length} digits are ≥ 7. Combined 8+9 freq: ${combinedPct.toFixed(1)}%`];

    const signal: TradeSignal = {
      id: generateId(),
      timestamp: Date.now(),
      symbol,
      signalType: confidence >= 85 ? 'STRONG_BUY' : 'BUY',
      confidence: Math.min(95, confidence),
      contractMode: 'DIGITUNDER',
      predictedDigit: this.config.underThreshold,
      direction: `Under ${this.config.underThreshold}`,
      currentTick: recentTicks[recentTicks.length - 1] ?? 0,
      recentTicks,
      reasoning: reasons,
      indicators: [
        { name: 'Under 8 Rule', value: `${secondLastDigit}, ${lastDigit}`, bullish: true },
        { name: 'High Digits', value: `${highCount}/${recentDigits.length}`, bullish: true },
        { name: 'Digit 8+9 Freq', value: `${combinedPct.toFixed(1)}%`, bullish: true },
      ],
      riskLevel: confidence >= 85 ? 'LOW' : 'MEDIUM',
      recommendedStake: stake,
      reasonForEntry: reasons[0],
      marketCondition: 'Rule-based Under 8',
      type: 'DIGITUNDER',
    };

    this.signals = [signal, ...this.signals].slice(0, 200);
    this.onSignal?.(signal);
    this.addActivity({ type: 'SIGNAL', message: `${symbol}: UNDER 8 | Digits ${secondLastDigit}, ${lastDigit} | ${highCount}/${recentDigits.length} high | 8+9: ${combinedPct.toFixed(1)}% | ${confidence.toFixed(0)}% confidence` });
    return signal;
  }

  analyzeMarket(symbol: string, digitStats: DigitStats, lastDigit: number, lastPrice: number): MarketAnalysis {
    const history = this.priceHistory.get(symbol) ?? [];
    const patterns = this.detectPatterns(history, digitStats, symbol);
    const streaks = this.analyzeStreaks(history, symbol);
    const volatility = this.calculateVolatility(history);
    const trend = this.analyzeTrend(history);
    const chiSquare = this.calculateChiSquare(digitStats);
    const entropy = this.calculateEntropy(digitStats);
    const zScore = this.calculateZScore(digitStats);
    const overUnderSignal = this.detectOverUnderSignal(digitStats, history);
    const dominantDigit = digitStats.percentages.indexOf(Math.max(...digitStats.percentages));
    const digitFrequencies: [number, number][] = digitStats.percentages.map((pct, idx) => [idx, pct]);

    const analysis: MarketAnalysis = {
      symbol, lastDigit, lastPrice, digitStats, patterns, streaks,
      volatility, trend, chiSquare, entropy, zScore, overUnderSignal,
      timestamp: Date.now(), dominantDigit, digitFrequencies,
    };
    this.lastAnalysis.set(symbol, analysis);
    return analysis;
  }

  generateSignal(analysis: MarketAnalysis, balance: number): TradeSignal | null {
    const { symbol, digitStats, patterns, streaks, volatility, trend, chiSquare, entropy, zScore, overUnderSignal, lastPrice } = analysis;

    if (digitStats.totalTicks < 20) return null;
    // AI market opportunity filter — skip unfavourable random markets
    if (!this.isFavourableMarket(analysis)) return null;

    const history = this.priceHistory.get(symbol) ?? [];
    const pip = this.getPipSize(symbol);
    const recentDigits = history.slice(-20).map(p => getLastDigit(p, pip));
    const lastDigit = recentDigits[recentDigits.length - 1] ?? 0;

    const reasons: string[] = [];
    const indicators: SignalIndicator[] = [];
    let confidence = 50;
    let contractMode: ContractMode = 'DIGITDIFF';
    let predictedDigit: number | undefined;
    let direction = 'Differs from';

    const avgPct = 10;
    const highestDigit = digitStats.percentages.indexOf(Math.max(...digitStats.percentages));
    const lowestDigit = digitStats.percentages.indexOf(Math.min(...digitStats.percentages));
    const highestPct = digitStats.percentages[highestDigit];
    const lowestPct = digitStats.percentages[lowestDigit];

    const lowDigitCount = recentDigits.filter(d => d <= 2).length;
    const highDigitCount = recentDigits.filter(d => d >= 7).length;
    const midDigitCount = recentDigits.filter(d => d >= 3 && d <= 6).length;

    const recentLowPct = (lowDigitCount / recentDigits.length) * 100;
    const recentHighPct = (highDigitCount / recentDigits.length) * 100;

    const overallLowPct = digitStats.percentages.slice(0, 3).reduce((a, b) => a + b, 0);
    const overallHighPct = digitStats.percentages.slice(7, 10).reduce((a, b) => a + b, 0);

    const momentum = recentLowPct - overallLowPct;
    const highMomentum = recentHighPct - overallHighPct;

    if (momentum > 8 && lowDigitCount >= 3) {
      confidence += 15;
      reasons.push(`Low digit momentum: ${recentLowPct.toFixed(0)}% recent vs ${overallLowPct.toFixed(0)}% overall`);
      indicators.push({ name: 'Low Momentum', value: `${momentum.toFixed(1)}%`, bullish: true });
    }
    if (highMomentum > 8 && highDigitCount >= 3) {
      confidence += 12;
      reasons.push(`High digit momentum: ${recentHighPct.toFixed(0)}% recent vs ${overallHighPct.toFixed(0)}% overall`);
      indicators.push({ name: 'High Momentum', value: `${highMomentum.toFixed(1)}%`, bullish: true });
    }

    if (lowDigitCount >= 4) {
      contractMode = 'DIGITOVER';
      direction = `Over ${this.config.overThreshold}`;
      confidence += 12;
      reasons.push(`${lowDigitCount} of last ${recentDigits.length} digits are ≤ 2`);
      indicators.push({ name: 'Over Signal', value: `${lowDigitCount}/${recentDigits.length}`, bullish: true });
    } else if (highDigitCount >= 4) {
      contractMode = 'DIGITUNDER';
      direction = `Under ${this.config.underThreshold}`;
      confidence += 12;
      reasons.push(`${highDigitCount} of last ${recentDigits.length} digits are ≥ 7`);
      indicators.push({ name: 'Under Signal', value: `${highDigitCount}/${recentDigits.length}`, bullish: true });
    }

    const coldDigits: number[] = [];
    const hotDigits: number[] = [];
    for (let i = 0; i < 10; i++) {
      const expected = 10;
      const actual = digitStats.percentages[i];
      if (actual < expected - 3) coldDigits.push(i);
      if (actual > expected + 3) hotDigits.push(i);
    }

    if (contractMode === 'DIGITDIFF' && coldDigits.length > 0) {
      const coldDigit = coldDigits[0];
      contractMode = 'DIGITDIFF';
      predictedDigit = coldDigit;
      direction = `Differ from ${coldDigit}`;
      confidence += 8;
      reasons.push(`Digit ${coldDigit} is cold at ${digitStats.percentages[coldDigit].toFixed(1)}%`);
    } else if (contractMode === 'DIGITDIFF' && hotDigits.length > 0) {
      const hotDigit = hotDigits[0];
      contractMode = 'DIGITMATCH';
      predictedDigit = hotDigit;
      direction = `Match ${hotDigit}`;
      confidence += 8;
      reasons.push(`Digit ${hotDigit} is hot at ${digitStats.percentages[hotDigit].toFixed(1)}%`);
    }

    const deviation = Math.sqrt(digitStats.percentages.reduce((sum, p) => sum + Math.pow(p - avgPct, 2), 0) / 10);
    indicators.push({ name: 'Digit Deviation', value: `${deviation.toFixed(1)}%`, bullish: deviation > 2 });
    if (deviation > 2) { confidence += 6; reasons.push(`Digit deviation ${deviation.toFixed(1)}%`); }

    if (chiSquare > 12) { confidence += 8; indicators.push({ name: 'Chi-Square', value: chiSquare.toFixed(1), bullish: true }); reasons.push(`χ²=${chiSquare.toFixed(1)}`); }
    else indicators.push({ name: 'Chi-Square', value: chiSquare.toFixed(1), bullish: false });

    if (entropy < 3.2) { confidence += 6; indicators.push({ name: 'Entropy', value: entropy.toFixed(2), bullish: true }); reasons.push(`Low entropy ${entropy.toFixed(2)}`); }
    else indicators.push({ name: 'Entropy', value: entropy.toFixed(2), bullish: false });

    if (Math.abs(zScore) > 1.5) { confidence += 5; indicators.push({ name: 'Z-Score', value: zScore.toFixed(2), bullish: true }); reasons.push(`Z-score ${zScore.toFixed(2)}`); }
    else indicators.push({ name: 'Z-Score', value: zScore.toFixed(2), bullish: false });

    for (const p of patterns) {
      if (p.confidence > 50) { confidence += p.confidence * 0.08; reasons.push(p.description); if (p.predictedNext !== undefined) predictedDigit = p.predictedNext; }
    }

    if (streaks.streakLength >= 3 && streaks.isBreaking) {
      confidence += 8; reasons.push(`${streaks.streakLength}x ${streaks.currentDigit} streak breaking`);
      indicators.push({ name: 'Streak Break', value: `${streaks.streakLength}x ${streaks.currentDigit}`, bullish: true });
    }

    if (volatility > 0.01) { confidence -= 5; } else if (volatility < 0.001) { confidence += 3; }
    indicators.push({ name: 'Volatility', value: volatility.toFixed(4), bullish: volatility > 0.001 && volatility < 0.01 });

    if (trend.strength > 70 && trend.direction !== 'SIDEWAYS') { confidence -= 3; }
    indicators.push({ name: 'Trend', value: `${trend.direction} (${trend.strength.toFixed(0)}%)`, bullish: trend.direction === 'SIDEWAYS' });

    if (this.config.overUnderStrategy && overUnderSignal && contractMode === 'DIGITDIFF') {
      confidence += overUnderSignal.confidence * 0.2;
      contractMode = overUnderSignal.type === 'OVER_2' ? 'DIGITOVER' : 'DIGITUNDER';
      direction = overUnderSignal.type === 'OVER_2' ? `Over ${this.config.overThreshold}` : `Under ${this.config.underThreshold}`;
      reasons.push(overUnderSignal.reason);
      indicators.push({ name: overUnderSignal.type === 'OVER_2' ? 'Over' : 'Under', value: `${overUnderSignal.confidence.toFixed(0)}%`, bullish: true });
    }

    let riskLevel: RiskLevel = 'MEDIUM';
    if (confidence >= 80) riskLevel = 'LOW';
    else if (confidence >= 65) riskLevel = 'MEDIUM';
    else if (confidence >= 50) riskLevel = 'HIGH';
    else riskLevel = 'EXTREME';

    // Adaptive threshold: if recent win-rate is poor, demand higher confidence
    const strat = this.getStrategyStats();
    const adaptiveMin = strat && strat.winRate < 0.5 && strat.count >= 8 ? 80 : this.config.minConfidence;
    if (strat && strat.winRate < 0.45 && strat.count >= 10 && confidence < 85) {
      return null; // be determinantly selective when losing
    }

    let signalType: SignalType;
    if (confidence >= adaptiveMin) signalType = confidence >= 85 ? 'STRONG_BUY' : 'BUY';
    else if (confidence >= 60) signalType = 'WAIT';
    else signalType = 'SELL';

    if (signalType === 'WAIT' || signalType === 'SELL') return null;

    // Favour contractModes that are currently winning
    if (strat && contractMode === 'DIGITDIFF' && strat.byMode['DIGITOVER']) {
      const over = strat.byMode['DIGITOVER'];
      const diff = strat.byMode['DIGITDIFF'];
      if (over && diff && over.total >= 3 && diff.total >= 3) {
        const overWR = over.wins / over.total;
        const diffWR = diff.wins / diff.total;
        if (overWR > diffWR + 0.2 && overWR > 0.6) {
          // keep over/under bias — don't dilute with diff
          return null;
        }
      }
    }

    const stake = Math.min(this.config.stake, balance * 0.05);
    const recentTicks = this.priceHistory.get(symbol)?.slice(-10) ?? [];

    const signal: TradeSignal = {
      id: generateId(), timestamp: Date.now(), symbol, signalType,
      confidence: Math.min(95, Math.max(0, confidence)), contractMode, predictedDigit,
      direction, currentTick: lastPrice, recentTicks, reasoning: reasons, indicators,
      riskLevel, recommendedStake: stake, reasonForEntry: reasons[0] || 'Statistical edge',
      marketCondition: `${trend.direction} ${volatility.toFixed(4)} Vol`, type: contractMode,
    };

    this.signals = [signal, ...this.signals].slice(0, 200);
    this.onSignal?.(signal);
    this.addActivity({ type: 'SIGNAL', message: `${symbol}: ${signalType} | ${contractMode} | ${confidence.toFixed(1)}% | ${riskLevel}` });
    return signal;
  }

  prepareTrade(signal: TradeSignal, balance: number): { stake: number; willTrade: boolean; reason?: string } {
    const check = this.canTrade();
    if (!check.allowed) {
      this.addActivity({ type: 'INFO', message: `Trade REJECTED: ${check.reason}` });
      return { stake: 0, willTrade: false, reason: check.reason };
    }
    if (signal.confidence < this.config.minConfidence) {
      return { stake: 0, willTrade: false, reason: `Confidence ${signal.confidence.toFixed(1)}% below threshold` };
    }
    const stake = Math.min(signal.recommendedStake, this.config.stake, balance * 0.1);
    if (stake < 0.35) return { stake: 0, willTrade: false, reason: 'Insufficient balance' };

    this.lastTradeTime = Date.now();
    const tradeRecord: TradeRecord = {
      id: signal.id, timestamp: Date.now(), symbol: signal.symbol,
      contractMode: signal.contractMode, signalConfidence: signal.confidence,
      stake, result: 'PENDING', profit: 0, reason: signal.reasonForEntry,
      signalType: signal.signalType, riskLevel: signal.riskLevel, digit: signal.predictedDigit,
    };
    this.tradeHistory = [tradeRecord, ...this.tradeHistory].slice(0, 500);
    this.addActivity({ type: 'TRADE', message: `EXECUTING ${signal.contractMode} on ${signal.symbol} | $${stake.toFixed(2)} | ${signal.confidence.toFixed(1)}%` });
    return { stake, willTrade: true };
  }

  private calculateChiSquare(stats: DigitStats): number {
    if (stats.totalTicks === 0) return 0;
    const expected = stats.totalTicks / 10;
    let chiSq = 0;
    for (let i = 0; i < 10; i++) {
      const observed = (stats.percentages[i] / 100) * stats.totalTicks;
      chiSq += Math.pow(observed - expected, 2) / expected;
    }
    return chiSq;
  }

  private calculateEntropy(stats: DigitStats): number {
    let entropy = 0;
    for (let i = 0; i < 10; i++) {
      const p = stats.percentages[i] / 100;
      if (p > 0) entropy -= p * Math.log2(p);
    }
    return entropy;
  }

  private calculateZScore(stats: DigitStats): number {
    if (stats.totalTicks < 10) return 0;
    const expected = 10;
    const maxDeviation = Math.max(...stats.percentages.map(p => Math.abs(p - expected)));
    const se = Math.sqrt((expected * (100 - expected)) / stats.totalTicks);
    return se > 0 ? maxDeviation / se : 0;
  }

  private detectOverUnderSignal(stats: DigitStats, _history: number[]): OverUnderSignal | null {
    if (stats.totalTicks < 10 || !this.config.overUnderStrategy) return null;
    const overCount = stats.counts.slice(this.config.overThreshold + 1).reduce((a, b) => a + b, 0);
    const overPct = (overCount / stats.totalTicks) * 100;
    const underCount = stats.counts.slice(0, this.config.underThreshold).reduce((a, b) => a + b, 0);
    const underPct = (underCount / stats.totalTicks) * 100;
    const expectedOver = (10 - this.config.overThreshold) * 10;
    const expectedUnder = this.config.underThreshold * 10;

    if (overPct > expectedOver + 3) {
      return { type: 'OVER_2', confidence: Math.min(85, 55 + (overPct - expectedOver)), digitFrequency: overPct, reason: `Digit >${this.config.overThreshold} at ${overPct.toFixed(1)}% (expected ${expectedOver}%)` };
    }
    if (underPct > expectedUnder + 3) {
      return { type: 'UNDER_8', confidence: Math.min(85, 55 + (underPct - expectedUnder)), digitFrequency: underPct, reason: `Digit <${this.config.underThreshold} at ${underPct.toFixed(1)}% (expected ${expectedUnder}%)` };
    }
    return null;
  }

  private detectPatterns(history: number[], stats: DigitStats, symbol?: string): PatternResult[] {
    const patterns: PatternResult[] = [];
    if (history.length < 10) return patterns;
    const pip = symbol ? this.getPipSize(symbol) : 2;
    const digitSequence = history.slice(-30).map(p => getLastDigit(p, pip));
    const consecutive = this.findConsecutivePattern(digitSequence);
    if (consecutive) patterns.push({ type: 'CONSECUTIVE', confidence: 65, description: consecutive.description, predictedNext: consecutive.predicted });
    const hotCold = this.findHotColdDigits(stats);
    if (hotCold) patterns.push({ type: 'HOTSPOT', confidence: 60, description: hotCold.description, predictedNext: hotCold.predicted });
    return patterns;
  }

  private findConsecutivePattern(seq: number[]): { description: string; predicted?: number } | null {
    if (seq.length < 3) return null;
    let maxRun = 1, currentRun = 1, runDigit = seq[0];
    for (let i = 1; i < seq.length; i++) {
      if (seq[i] === seq[i - 1]) { currentRun++; if (currentRun > maxRun) { maxRun = currentRun; runDigit = seq[i]; } }
      else currentRun = 1;
    }
    return maxRun >= 2 ? { description: `${maxRun}x consecutive ${runDigit}`, predicted: runDigit } : null;
  }

  private findHotColdDigits(stats: DigitStats): { description: string; predicted?: number } | null {
    if (stats.totalTicks < 10) return null;
    const hot: number[] = [], cold: number[] = [];
    for (let i = 0; i < 10; i++) {
      if (stats.percentages[i] > 12) hot.push(i);
      else if (stats.percentages[i] < 8) cold.push(i);
    }
    if (hot.length > 0) return { description: `Hot: ${hot.join(', ')}`, predicted: hot[0] };
    if (cold.length > 0) return { description: `Cold: ${cold.join(', ')}`, predicted: cold[0] };
    return null;
  }

  private analyzeStreaks(history: number[], symbol?: string): StreakInfo {
    if (history.length === 0) return { currentDigit: 0, streakLength: 0, isBreaking: false, longestStreak: 0 };
    const pip = symbol ? this.getPipSize(symbol) : 2;
    const lastPrice = history[history.length - 1];
    const lastDigit = getLastDigit(lastPrice, pip);
    let streakLength = 1;
    let longestStreak = 1;
    let currentRun = 1;
    for (let i = history.length - 2; i >= 0; i--) {
      const d = getLastDigit(history[i], pip);
      if (d === lastDigit && i >= history.length - 1 - streakLength) streakLength++;
      if (i > 0) {
        const prev = getLastDigit(history[i - 1], pip);
        if (d === prev) { currentRun++; longestStreak = Math.max(longestStreak, currentRun); } else currentRun = 1;
      }
    }
    const isBreaking = history.length >= 2 && getLastDigit(history[history.length - 2], pip) !== lastDigit && streakLength === 1;
    return { currentDigit: lastDigit, streakLength, isBreaking, longestStreak };
  }

  private calculateVolatility(history: number[]): number {
    if (history.length < 10) return 0;
    const recent = history.slice(-30);
    const changes: number[] = [];
    for (let i = 1; i < recent.length; i++) changes.push(Math.abs(recent[i] - recent[i - 1]));
    return changes.length > 0 ? changes.reduce((a, b) => a + b, 0) / changes.length : 0;
  }

  private analyzeTrend(history: number[]): TrendInfo {
    if (history.length < 20) return { direction: 'SIDEWAYS', strength: 0, recentAverage: 0, historicalAverage: 0 };
    const recent = history.slice(-10);
    const older = history.slice(-20, -10);
    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const olderAvg = older.length > 0 ? older.reduce((a, b) => a + b, 0) / older.length : recentAvg;
    const diff = recentAvg - olderAvg;
    const avgPrice = history.reduce((a, b) => a + b, 0) / history.length;
    const normalizedDiff = avgPrice > 0 ? Math.abs(diff) / avgPrice * 100 : 0;
    let direction: 'RISING' | 'FALLING' | 'SIDEWAYS';
    if (diff > 0.001) direction = 'RISING';
    else if (diff < -0.001) direction = 'FALLING';
    else direction = 'SIDEWAYS';
    return { direction, strength: Math.min(100, normalizedDiff * 10), recentAverage: recentAvg, historicalAverage: olderAvg };
  }
}
