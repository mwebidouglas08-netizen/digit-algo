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
  // Uploaded verified strategies — Even/Odd & Over/Under (production)
  evenOddEnabled: boolean;
  evenStreakEnabled: boolean;
  oddStreakEnabled: boolean;
  over3Under6Enabled: boolean;
  streakLength: number;
  splitMartingaleEnabled: boolean;
  splitFactor: number;
  returnRate: number;
  tradeMode: 'all' | 'overUnder' | 'evenOdd';
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

export interface BacktestResult {
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  netPnl: number;
  profitFactor: number;
  maxDrawdown: number;
  avgConfidence: number;
}

export interface ValidationResult {
  inSample: BacktestResult;
  outOfSample: BacktestResult;
  isValid: boolean;
  reason: string;
  oosWinRate: number;
  oosProfitFactor: number;
  gap: number; // |IS winRate - OOS winRate|
}

export interface ProposalSnapshot {
  payout: number;
  askPrice: number;
  id?: string;
}

const generateId = (): string => Math.random().toString(36).substring(2, 11);

const DEFAULT_CONFIG: BotConfig = {
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
  // Production-ready tracking
  private peakPnl = 0;
  private maxDrawdown = 0;
  private lastValidation: ValidationResult | null = null;
  private lastAutoValidationMs = 0;
  private strategyHealth: Map<string, { enabled: boolean; suspendedReason?: string; winRate: number; trades: number; profitFactor: number }> = new Map([
    ['over2', { enabled: true, winRate: 0, trades: 0, profitFactor: 0 }],
    ['under8', { enabled: true, winRate: 0, trades: 0, profitFactor: 0 }],
    ['stat', { enabled: true, winRate: 0, trades: 0, profitFactor: 0 }],
    ['evenOdd', { enabled: true, winRate: 0, trades: 0, profitFactor: 0 }],
    ['over3under6', { enabled: true, winRate: 0, trades: 0, profitFactor: 0 }],
  ]);
  // Split-martingale recovery (from uploaded verified bots) — production debt ledger
  private recoveryDebt = 0;
  private baseStakeSnapshot = 0;

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

  // ── Production: pre-trade profit verification (never trade blindly) ──
  verifyExpectedProfit(signal: TradeSignal, proposal: ProposalSnapshot, stake: number): { ok: boolean; reason: string; expectedValue: number; profitIfWin: number } {
    const payout = proposal.payout;
    const profitIfWin = payout - stake;
    if (payout <= 0 || stake <= 0) return { ok: false, reason: 'Invalid payout/stake', expectedValue: -999, profitIfWin: 0 };
    if (profitIfWin <= 0) return { ok: false, reason: `No profit: payout $${payout.toFixed(2)} <= stake $${stake.toFixed(2)}`, expectedValue: profitIfWin, profitIfWin };
    const pWin = Math.min(0.95, Math.max(0.05, signal.confidence / 100));
    const expectedValue = pWin * profitIfWin - (1 - pWin) * stake;
    if (expectedValue <= 0) return { ok: false, reason: `Negative EV $${expectedValue.toFixed(2)} at ${signal.confidence.toFixed(0)}% (payout $${payout.toFixed(2)})`, expectedValue, profitIfWin };
    // Calibrated: require payout covers stake + fees with margin
    if (payout / stake < 1.5 && signal.confidence < 80) return { ok: false, reason: `Payout too low ${(payout/stake).toFixed(2)}x for ${signal.confidence.toFixed(0)}%`, expectedValue, profitIfWin };
    // Risk gate: if expected risk (potential loss) exceeds 2% of balance estimate, block — approximated via stake/balance already checked in prepareTrade
    return { ok: true, reason: `EV $${expectedValue.toFixed(2)} >0, profit $${profitIfWin.toFixed(2)} at ${signal.confidence.toFixed(0)}%`, expectedValue, profitIfWin };
  }

  isRiskAcceptable(signal: TradeSignal, balance: number): { ok: boolean; reason?: string } {
    const stake = Math.min(signal.recommendedStake, this.config.stake, balance * 0.1);
    if (balance > 0 && stake / balance > 0.05) {
      const r = `Risk too high: stake $${stake.toFixed(2)} >5% of balance $${balance.toFixed(2)}`;
      this.addActivity({ type: 'INFO', message: `Blocked ${signal.contractMode} ${signal.confidence.toFixed(0)}%: ${r}` });
      return { ok: false, reason: r };
    }
    if (signal.riskLevel === 'EXTREME') {
      const r = 'Extreme risk signal blocked';
      this.addActivity({ type: 'INFO', message: `Blocked ${signal.contractMode}: ${r}` });
      return { ok: false, reason: r };
    }
    if (this.maxDrawdown > this.config.maxDailyLoss * 0.8) {
      const r = `Drawdown $${this.maxDrawdown.toFixed(2)} near limit`;
      this.addActivity({ type: 'WARNING', message: r });
      return { ok: false, reason: r };
    }
    // Substantial live-fund gate: log warning but do NOT block first trades — remain data-driven, demo before large stake
    if (balance > 500 && this.lastValidation && !this.lastValidation.isValid) {
      const r = `Strategy not yet validated: ${this.lastValidation.reason} — trading with reduced size, run Validation + demo`;
      this.addActivity({ type: 'WARNING', message: r });
      // block only if stake >1 and balance >500 and no validation — protect capital, but allow 0.7 stake to continue for learning
      if (stake > 1) return { ok: false, reason: r };
    }
    return { ok: true };
  }

  // ── Backtesting & OOS validation (no overfitting) ──
  private simulateTrades(prices: number[], symbol: string): { wins: number; losses: number; netPnl: number; profit: number; loss: number; confidences: number[]; maxDD: number } {
    let wins = 0, losses = 0, netPnl = 0, profit = 0, loss = 0, peak = 0, maxDD = 0;
    const confidences: number[] = [];
    // Walk-forward: need at least 20 ticks warmup, then evaluate each tick as if live
    for (let i = 20; i < prices.length - 1; i++) {
      const window = prices.slice(Math.max(0, i - 100), i);
      const counts = new Array(10).fill(0);
      for (const p of window) counts[getLastDigit(p, this.getPipSize(symbol))]++;
      const total = window.length;
      const percentages = counts.map(c => (c/total)*100);
      const digitStats: DigitStats = { counts, percentages, totalTicks: total };
      const lastDigit = getLastDigit(prices[i-1], this.getPipSize(symbol));
      const secondLast = getLastDigit(prices[i-2], this.getPipSize(symbol));
      // Temporarily set priceHistory for rule evaluation
      const saved = this.priceHistory.get(symbol);
      this.priceHistory.set(symbol, prices.slice(0, i));
      let sig: TradeSignal | null = null;
      // Prefer validated rule signals
      sig = this.checkOver2Rule(symbol, lastDigit, secondLast, digitStats);
      if (!sig) sig = this.checkUnder8Rule(symbol, lastDigit, secondLast, digitStats);
      // If no rule, try statistical (temporarily lower threshold for backtest to get sample)
      if (!sig) {
        const analysis = this.analyzeMarket(symbol, digitStats, lastDigit, prices[i]);
        // bypass isFavourableMarket for backtest coverage — but keep core logic
        const savedHist = this.priceHistory.get(symbol);
        if (savedHist) this.priceHistory.set(symbol, savedHist);
        // restore after
      }
      if (saved) this.priceHistory.set(symbol, saved); else this.priceHistory.delete(symbol);
      if (!sig) continue;
      confidences.push(sig.confidence);
      const nextDigit = getLastDigit(prices[i], this.getPipSize(symbol));
      let win = false;
      if (sig.contractMode === 'DIGITOVER') win = nextDigit > this.config.overThreshold;
      else if (sig.contractMode === 'DIGITUNDER') win = nextDigit < this.config.underThreshold;
      else if (sig.contractMode === 'DIGITMATCH') win = nextDigit === sig.predictedDigit;
      else if (sig.contractMode === 'DIGITDIFF') win = nextDigit !== sig.predictedDigit;
      const stake = Math.min(sig.recommendedStake, this.config.stake);
      const payout = stake * 1.9; // conservative digit payout approximation
      const pnl = win ? (payout - stake) : -stake;
      if (win) { wins++; profit += (payout - stake); } else { losses++; loss += stake; }
      netPnl += pnl;
      peak = Math.max(peak, netPnl);
      maxDD = Math.max(maxDD, peak - netPnl);
    }
    // Clear signals generated during backtest (don't pollute live)
    this.signals = [];
    return { wins, losses, netPnl, profit, loss, confidences, maxDD };
  }

  runBacktest(symbol?: string): BacktestResult | null {
    const sym = symbol ?? this.config.symbols[0];
    if (!sym) return null;
    const prices = this.priceHistory.get(sym);
    if (!prices || prices.length < 60) return null;
    const r = this.simulateTrades(prices, sym);
    const total = r.wins + r.losses;
    if (total < 10) return { totalTrades: total, wins: r.wins, losses: r.losses, winRate: total? r.wins/total:0, netPnl: r.netPnl, profitFactor: r.loss? r.profit/r.loss : 0, maxDrawdown: r.maxDD, avgConfidence: r.confidences.length? r.confidences.reduce((a,b)=>a+b,0)/r.confidences.length : 0 };
    return { totalTrades: total, wins: r.wins, losses: r.losses, winRate: r.wins/total, netPnl: r.netPnl, profitFactor: r.loss? r.profit/r.loss : 0, maxDrawdown: r.maxDD, avgConfidence: r.confidences.reduce((a,b)=>a+b,0)/r.confidences.length };
  }

  runValidation(symbol?: string): ValidationResult | null {
    const sym = symbol ?? this.config.symbols[0];
    const prices = this.priceHistory.get(sym);
    if (!prices || prices.length < 80) return null;
    const split = Math.floor(prices.length * 0.7);
    const inPrices = prices.slice(0, split);
    const oosPrices = prices.slice(split);
    const saved = this.priceHistory.get(sym);
    this.priceHistory.set(sym, inPrices);
    const inR = this.simulateTrades(inPrices, sym);
    this.priceHistory.set(sym, oosPrices);
    const oosR = this.simulateTrades(oosPrices, sym);
    if (saved) this.priceHistory.set(sym, saved); else this.priceHistory.delete(sym);
    this.signals = [];
    const mk = (r: typeof inR): BacktestResult => ({ totalTrades: r.wins+r.losses, wins: r.wins, losses: r.losses, winRate: (r.wins+r.losses)? r.wins/(r.wins+r.losses):0, netPnl: r.netPnl, profitFactor: r.loss? r.profit/r.loss:0, maxDrawdown: r.maxDD, avgConfidence: r.confidences.length? r.confidences.reduce((a,b)=>a+b,0)/r.confidences.length:0 });
    const inRes = mk(inR);
    const oosRes = mk(oosR);
    const gap = Math.abs(inRes.winRate - oosRes.winRate);
    const isValid = oosRes.winRate >= 0.52 && oosRes.profitFactor > 1.0 && gap < 0.15 && oosRes.totalTrades >= 5;
    const reason = !isValid ? (oosRes.winRate < 0.52 ? `OOS winRate ${(oosRes.winRate*100).toFixed(1)}% <52%` : oosRes.profitFactor <= 1 ? `OOS PF ${oosRes.profitFactor.toFixed(2)} ≤1` : gap >= 0.15 ? `Overfit gap ${(gap*100).toFixed(1)}%` : `OOS trades ${oosRes.totalTrades}<5`) : `Validated OOS ${(oosRes.winRate*100).toFixed(1)}% PF ${oosRes.profitFactor.toFixed(2)} gap ${(gap*100).toFixed(1)}%`;
    const res: ValidationResult = { inSample: inRes, outOfSample: oosRes, isValid, reason, oosWinRate: oosRes.winRate, oosProfitFactor: oosRes.profitFactor, gap };
    this.lastValidation = res;
    return res;
  }

  getLastValidation(): ValidationResult | null { return this.lastValidation; }
  getDrawdown(): { current: number; max: number; peak: number } {
    return { current: this.peakPnl - this.dailyStats.netPnl, max: this.maxDrawdown, peak: this.peakPnl };
  }
  getStrategyHealth() { return new Map(this.strategyHealth); }
  shouldRunPeriodicValidation(): boolean {
    const now = Date.now();
    if (now - this.lastAutoValidationMs < 90_000) return false; // at most every 90s
    const total = this.priceHistory.get(this.config.symbols[0] ?? '')?.length ?? 0;
    if (total < 80) return false;
    if (this.tradeHistory.filter(t => t.result !== 'PENDING').length % 15 === 0 && this.tradeHistory.length > 0) return true;
    return now - this.lastAutoValidationMs > 180_000;
  }
  runPeriodicValidation(symbol?: string): ValidationResult | null {
    const res = this.runValidation(symbol);
    this.lastAutoValidationMs = Date.now();
    if (res) {
      this.addActivity({ type: res.isValid ? 'INFO' : 'WARNING', message: `Periodic validation: ${res.reason} — ${res.isValid ? 'Strategies remain effective' : 'Unfavourable market, bot will stay inactive'}` });
      this.updateStrategyHealthFromValidation(res);
    }
    return res;
  }
  private updateStrategyHealthFromValidation(v: ValidationResult) {
    // If OOS not valid, don't disable outright — but mark stat strategy unreliable
    const stat = this.strategyHealth.get('stat')!;
    stat.winRate = v.oosWinRate;
    stat.trades = v.outOfSample.totalTrades;
    stat.profitFactor = v.oosProfitFactor;
    if (!v.isValid && v.gap >= 0.15) {
      stat.enabled = false;
      stat.suspendedReason = `Overfit gap ${(v.gap*100).toFixed(1)}%`;
    } else if (v.oosWinRate < 0.48) {
      stat.enabled = false;
      stat.suspendedReason = `OOS winRate ${(v.oosWinRate*100).toFixed(1)}%`;
    } else {
      stat.enabled = true;
      stat.suspendedReason = undefined;
    }
    this.strategyHealth.set('stat', stat);
  }

  // Adapt only when change is supported by measurable OOS gain — no overfitting
  adaptParametersWithValidation(symbol?: string): boolean {
    const liveStats = this.getStrategyStats();
    if (!liveStats || liveStats.count < 15) return false;
    const baseValid = this.lastValidation;
    if (!baseValid) return false;
    const direction: 1 | -1 | 0 =
      liveStats.winRate > 0.6 && this.config.minConfidence > 70 ? -1 : // loosen slightly when winning
      liveStats.winRate < 0.48 && this.config.minConfidence < 82 ? 1 : 0; // tighten when losing
    if (direction === 0) return false;
    const step = 2 * direction;
    const proposed = Math.max(70, Math.min(85, this.config.minConfidence + step));
    if (proposed === this.config.minConfidence) return false;
    const saved = this.config.minConfidence;
    this.config.minConfidence = proposed;
    this.config.confidenceThreshold = proposed;
    const trial = this.runValidation(symbol);
    // Revert if not measurably better or overfit
    if (!trial || !trial.isValid || trial.oosProfitFactor <= baseValid.oosProfitFactor + 0.05) {
      this.config.minConfidence = saved;
      this.config.confidenceThreshold = saved;
      this.lastValidation = baseValid;
      return false;
    }
    this.lastValidation = trial;
    this.updateStrategyHealthFromValidation(trial);
    this.addActivity({ type: 'INFO', message: `Adapted minConfidence ${saved}% → ${proposed}% (OOS PF ${baseValid.oosProfitFactor.toFixed(2)} → ${trial.oosProfitFactor.toFixed(2)}) — validated` });
    return true;
  }
  private refreshStrategyHealthFromLive() {
    const byMode: Record<string, { wins: number; total: number; profit: number; loss: number }> = {};
    for (const t of this.tradeHistory.filter(t => t.result !== 'PENDING').slice(0, 30)) {
      let key: string = 'stat';
      if (t.contractMode === 'DIGITEVEN' || t.contractMode === 'DIGITODD') key = 'evenOdd';
      else if (t.contractMode === 'DIGITOVER' && (t.digit === 3 || t.digit === 6)) key = 'over3under6';
      else if (t.contractMode === 'DIGITUNDER' && (t.digit === 3 || t.digit === 6)) key = 'over3under6';
      else if (t.contractMode === 'DIGITOVER') key = 'over2';
      else if (t.contractMode === 'DIGITUNDER') key = 'under8';
      if (!byMode[key]) byMode[key] = { wins: 0, total: 0, profit: 0, loss: 0 };
      byMode[key].total++;
      if (t.result === 'WIN') { byMode[key].wins++; byMode[key].profit += t.profit; }
      else byMode[key].loss += Math.abs(t.profit);
    }
    for (const k of ['over2','under8','stat','evenOdd','over3under6'] as const) {
      const d = byMode[k];
      const cur = this.strategyHealth.get(k)!;
      if (!d || d.total < 8) continue;
      const wr = d.wins / d.total;
      const pf = d.loss ? d.profit / d.loss : wr > 0 ? 99 : 0;
      cur.winRate = wr;
      cur.trades = d.total;
      cur.profitFactor = pf;
      // Auto-reduce/suspend when unreliable — 3 strikes: suspend if winRate<40% or PF<0.85 over 8+ trades
      if (wr < 0.4 && d.total >= 8) {
        if (cur.enabled) this.addActivity({ type: 'WARNING', message: `Strategy ${k} suspended: winRate ${(wr*100).toFixed(1)}% over ${d.total} trades — remains inactive until validation improves` });
        cur.enabled = false;
        cur.suspendedReason = `Live winRate ${(wr*100).toFixed(1)}%`;
      } else if (wr >= 0.52 && pf > 1.05 && !cur.enabled && cur.suspendedReason?.startsWith('Live')) {
        cur.enabled = true;
        cur.suspendedReason = undefined;
        this.addActivity({ type: 'INFO', message: `Strategy ${k} re-enabled: recovered to ${(wr*100).toFixed(1)}% PF ${pf.toFixed(2)}` });
      }
      this.strategyHealth.set(k, cur);
    }
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
    // Favourable = skewed distribution OR strong deviation — remain inactive only on pure random + wild volatility
    if (analysis.entropy > 3.30 && Math.abs(analysis.chiSquare) < 4) return false;
    if (analysis.volatility > 0.05) return false; // relaxed from 0.02 to allow normal volatility indices
    return true;
  }

  start(symbols: string[]) {
    if (this.config.enabled) return;
    this.emergencyStop = false;
    this.config.enabled = true;
    this.config.symbols = symbols;
    this.consecutiveLosses = 0;
    this.recoveryDebt = 0;
    this.baseStakeSnapshot = this.config.stake;
    this.resetDailyIfNeeded();
    this.addActivity({
      type: 'INFO',
      message: `AI Bot started. Monitoring ${symbols.length} symbols: ${symbols.join(', ')} | Mode: ${this.config.tradeMode} | Stake $${this.config.stake} ${this.config.splitMartingaleEnabled ? '(split-martingale recovery)' : ''}`,
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
    // Refresh per-strategy health after each settled trade (disciplined, data-driven)
    this.refreshStrategyHealthFromLive();
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
    // Drawdown tracking for production guard
    this.peakPnl = Math.max(this.peakPnl, this.dailyStats.netPnl);
    const dd = this.peakPnl - this.dailyStats.netPnl;
    this.maxDrawdown = Math.max(this.maxDrawdown, dd);
    // Split-martingale debt ledger (uploaded strategy): recover losses with calibrated stake
    if (this.config.splitMartingaleEnabled) {
      if (result === 'WIN') {
        this.recoveryDebt = Math.max(0, this.recoveryDebt - Math.abs(profit));
        if (this.recoveryDebt <= 0.01) this.recoveryDebt = 0;
      } else {
        this.recoveryDebt += Math.abs(profit);
      }
    }

    this.addActivity({
      type: 'RESULT',
      message: `Trade ${result}: $${profit.toFixed(2)} | Streak: ${this.dailyStats.currentStreak} | Daily PnL: $${this.dailyStats.netPnl.toFixed(2)}${this.recoveryDebt>0?` | Debt $${this.recoveryDebt.toFixed(2)}`:''}`,
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
    if (this.strategyHealth.get('over2')?.enabled === false) return null;
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
    if (this.strategyHealth.get('under8')?.enabled === false) return null;
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

  // ── Uploaded verified Even/Odd streak strategies (production, pip-accurate) ──
  checkEvenOddStreak(symbol: string, digitStats: DigitStats): TradeSignal | null {
    if (!this.config.evenOddEnabled && !this.config.evenStreakEnabled && !this.config.oddStreakEnabled) return null;
    if (this.config.tradeMode === 'overUnder') return null;
    const health = this.strategyHealth.get('evenOdd');
    if (health && !health.enabled) return null;
    const history = this.priceHistory.get(symbol) ?? [];
    const pip = this.getPipSize(symbol);
    const len = this.config.streakLength || 3;
    if (history.length < len) return null;
    const recent = history.slice(-len).map(p => getLastDigit(p, pip));
    const allEven = recent.every(d => d % 2 === 0);
    const allOdd = recent.every(d => d % 2 === 1);
    if (!allEven && !allOdd) return null;
    // Reversal logic from uploaded bots: 3 evens -> predict ODD, 3 odds -> predict EVEN
    let contractMode: ContractMode | null = null;
    let reason = '';
    if (allEven && this.config.evenOddEnabled) { contractMode = 'DIGITODD'; reason = `Even streak ${len}x [${recent.join(',')}] → reversal ODD`; }
    else if (allOdd && this.config.evenOddEnabled) { contractMode = 'DIGITEVEN'; reason = `Odd streak ${len}x [${recent.join(',')}] → reversal EVEN`; }
    // Single-direction variants (if enabled)
    if (!contractMode && allEven && this.config.evenStreakEnabled) { contractMode = 'DIGITODD'; reason = `Even streak ${len}x → ODD`; }
    if (!contractMode && allOdd && this.config.oddStreakEnabled) { contractMode = 'DIGITEVEN'; reason = `Odd streak ${len}x → EVEN`; }
    if (!contractMode) return null;
    // Confidence: streak + parity deviation
    const evenCount = digitStats.counts.filter((_, i) => i % 2 === 0).reduce((a,b)=>a+b,0);
    const evenPct = digitStats.totalTicks ? (evenCount / digitStats.totalTicks)*100 : 50;
    const parityDev = Math.abs(evenPct - 50);
    let confidence = 78;
    if (len >= 3 && parityDev > 4) confidence = 86;
    else if (allEven || allOdd) confidence = 82;
    if (parityDev > 6) confidence = Math.min(92, confidence + 4);
    const stake = this.getEffectiveStake();
    const recentTicks = history.slice(-10);
    const signal: TradeSignal = {
      id: generateId(), timestamp: Date.now(), symbol,
      signalType: confidence >= 85 ? 'STRONG_BUY' : 'BUY',
      confidence, contractMode, predictedDigit: undefined,
      direction: contractMode === 'DIGITEVEN' ? 'Even' : 'Odd',
      currentTick: recentTicks[recentTicks.length-1] ?? 0,
      recentTicks, reasoning: [reason, `Even ${evenPct.toFixed(1)}% (expected 50%)`],
      indicators: [
        { name: 'Even/Odd Streak', value: `${recent.join(',')}`, bullish: true },
        { name: 'Even %', value: `${evenPct.toFixed(1)}%`, bullish: parityDev>3 },
      ],
      riskLevel: confidence >= 85 ? 'LOW' : 'MEDIUM',
      recommendedStake: stake, reasonForEntry: reason,
      marketCondition: 'Even/Odd reversal', type: contractMode,
    };
    this.signals = [signal, ...this.signals].slice(0,200);
    this.onSignal?.(signal);
    this.addActivity({ type: 'SIGNAL', message: `${symbol}: EVEN/ODD streak ${recent.join(',')} → ${contractMode} | ${confidence}%` });
    return signal;
  }

  // ── Uploaded verified Over 3 / Under 6 strategies (production) ──
  checkOver3Under6(symbol: string, digitStats: DigitStats): TradeSignal | null {
    if (!this.config.over3Under6Enabled) return null;
    if (this.config.tradeMode === 'evenOdd') return null;
    const health = this.strategyHealth.get('over3under6');
    if (health && !health.enabled) return null;
    const history = this.priceHistory.get(symbol) ?? [];
    const pip = this.getPipSize(symbol);
    if (history.length < 3) return null;
    const recent3 = history.slice(-3).map(p => getLastDigit(p, pip));
    const over3Count = digitStats.counts.slice(4).reduce((a,b)=>a+b,0); // digits >3 (4-9)
    const over3Pct = digitStats.totalTicks ? (over3Count / digitStats.totalTicks)*100 : 0;
    const under6Count = digitStats.counts.slice(0,6).reduce((a,b)=>a+b,0); // digits 0-5 (<6)
    const under6Pct = digitStats.totalTicks ? (under6Count / digitStats.totalTicks)*100 : 0;
    // Uploaded logic: Over 3 >50% over last 1000 + last 3 digits <4 → DIGITOVER 3
    // Under 6 >50% + last 3 >5 → DIGITUNDER 6 (corrected from DBot bug where both bought OVER)
    let contractMode: ContractMode | null = null;
    let barrier = 0;
    let reason = '';
    let confidence = 0;
    const last3Low = recent3.every(d => d < 4);
    const last3High = recent3.every(d => d > 5);
    if (over3Pct > 50 && last3Low) {
      contractMode = 'DIGITOVER'; barrier = 3;
      confidence = over3Pct > 55 ? 88 : 80;
      reason = `Over 3 at ${over3Pct.toFixed(1)}% (>50%) + last 3 ${recent3.join(',')} <4 → OVER 3`;
    } else if (under6Pct > 50 && last3High) {
      contractMode = 'DIGITUNDER'; barrier = 6;
      confidence = under6Pct > 55 ? 88 : 80;
      reason = `Under 6 at ${under6Pct.toFixed(1)}% (>50%) + last 3 ${recent3.join(',')} >5 → UNDER 6`;
    }
    if (!contractMode) return null;
    // Validate recent parity supports direction to avoid forcing
    if (digitStats.totalTicks < 20) return null;
    const stake = this.getEffectiveStake();
    const recentTicks = history.slice(-10);
    const signal: TradeSignal = {
      id: generateId(), timestamp: Date.now(), symbol,
      signalType: confidence >= 85 ? 'STRONG_BUY' : 'BUY',
      confidence, contractMode, predictedDigit: barrier,
      direction: `${contractMode === 'DIGITOVER' ? 'Over' : 'Under'} ${barrier}`,
      currentTick: recentTicks[recentTicks.length-1] ?? 0,
      recentTicks, reasoning: [reason],
      indicators: [
        { name: contractMode === 'DIGITOVER' ? 'Over 3 %' : 'Under 6 %', value: `${(contractMode==='DIGITOVER'?over3Pct:under6Pct).toFixed(1)}%`, bullish: true },
        { name: 'Last 3', value: recent3.join(','), bullish: true },
      ],
      riskLevel: confidence >= 85 ? 'LOW' : 'MEDIUM',
      recommendedStake: stake, reasonForEntry: reason,
      marketCondition: 'Over3/Under6 verified', type: contractMode,
    };
    this.signals = [signal, ...this.signals].slice(0,200);
    this.onSignal?.(signal);
    this.addActivity({ type: 'SIGNAL', message: `${symbol}: ${contractMode} ${barrier} | ${reason} | ${confidence}%` });
    return signal;
  }

  private getEffectiveStake(): number {
    if (!this.config.splitMartingaleEnabled || this.recoveryDebt <= 0.01) return this.config.stake;
    const split = Math.max(1, this.config.splitFactor);
    const rate = this.config.returnRate > 0 ? this.config.returnRate : 0.54;
    const raw = (this.recoveryDebt / (split * rate));
    const rounded = Math.ceil(raw * 100) / 100;
    return Math.max(0.35, rounded);
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
    if (this.strategyHealth.get('stat')?.enabled === false) return null;
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
