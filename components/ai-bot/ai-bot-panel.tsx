'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Zap, Settings, BarChart3, History, TrendingUp,
  AlertTriangle, X, Play, Pause, ChevronDown, ChevronUp,
  Shield, Target, Clock, Activity, DollarSign,
  TrendingDown, Minus, Plus, RefreshCw, Wifi, WifiOff
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { BotConfig, BotActivity, TradeSignal, TradeRecord, DailyStats, MarketAnalysis, ValidationResult, BacktestResult } from './ai-bot-engine';

interface AIBotPanelProps {
  isOpen: boolean;
  onClose: () => void;
  isRunning: boolean;
  config: BotConfig;
  activities: BotActivity[];
  signals: TradeSignal[];
  tradeHistory: TradeRecord[];
  dailyStats: DailyStats;
  lastAnalysis: MarketAnalysis | null;
  emergencyStop: boolean;
  onStart: () => void;
  onStop: () => void;
  onUpdateConfig: (updates: Partial<BotConfig>) => void;
  onEmergencyStop: () => void;
  onResetEmergencyStop: () => void;
  balance: number;
  tickCount: number;
  currentSymbol: string | null;
  isConnected: boolean;
  validation?: ValidationResult | null;
  drawdown?: { current: number; max: number; peak: number };
  onRunValidation?: () => ValidationResult | null;
  onRunBacktest?: () => BacktestResult | null;
  strategyHealth?: Map<string, { enabled: boolean; suspendedReason?: string; winRate: number; trades: number; profitFactor: number }>;
}

type Tab = 'dashboard' | 'signals' | 'history' | 'settings';

const ALL_MARKETS = [
  { id: 'Volatility 10', label: 'Vol 10' },
  { id: 'Volatility 25', label: 'Vol 25' },
  { id: 'Volatility 50', label: 'Vol 50' },
  { id: 'Volatility 75', label: 'Vol 75' },
  { id: 'Volatility 100', label: 'Vol 100' },
  { id: 'Volatility 10 (1s)', label: 'Vol 10 (1s)' },
  { id: 'Volatility 25 (1s)', label: 'Vol 25 (1s)' },
  { id: 'Volatility 50 (1s)', label: 'Vol 50 (1s)' },
  { id: 'Volatility 75 (1s)', label: 'Vol 75 (1s)' },
  { id: 'Volatility 100 (1s)', label: 'Vol 100 (1s)' },
  { id: 'Boom 1000', label: 'Boom 1000' },
  { id: 'Boom 500', label: 'Boom 500' },
  { id: 'Boom 300', label: 'Boom 300' },
  { id: 'Crash 1000', label: 'Crash 1000' },
  { id: 'Crash 500', label: 'Crash 500' },
  { id: 'Crash 300', label: 'Crash 300' },
  { id: 'Jump 10', label: 'Jump 10' },
  { id: 'Jump 25', label: 'Jump 25' },
  { id: 'Jump 50', label: 'Jump 50' },
  { id: 'Jump 75', label: 'Jump 75' },
  { id: 'Jump 100', label: 'Jump 100' },
];

const STRATEGIES = [
  { id: 'over2', label: 'Over 2 (Assured)', desc: 'When last 2 digits ≤2 AND 3+ of last 10 ≤2 — DIGITOVER 2. Verified, pip-accurate. (Uploaded: Over 3 baseline)' },
  { id: 'under8', label: 'Under 8 (Assured)', desc: 'When last 2 digits ≥7 AND 8+9 combined <15% — DIGITUNDER 8. Verified, high confidence only.' },
  { id: 'evenOdd', label: 'Even/Odd Streak (Combined)', desc: 'Uploaded Even_Odd_Combined_Streak_Bot: 3 evens → ODD, 3 odds → EVEN. Reversal, 100-tick history.' },
  { id: 'evenStreak', label: 'Even Streak → Odd', desc: 'Uploaded Even_Streak_Bot: 3 consecutive evens → DIGITODD. Production streak len 3.' },
  { id: 'oddStreak', label: 'Odd Streak → Even', desc: 'Uploaded Odd_Streak_Bot: 3 consecutive odds → DIGITEVEN. Production reversal.' },
  { id: 'over3under6', label: 'Over 3 / Under 6', desc: 'Uploaded Split_Martingale OVER 3 & UNDER 6: Over 3 >50% + last 3 <4 → OVER 3, Under 6 >50% + last 3 >5 → UNDER 6. Verified.' },
  { id: 'hotspot', label: 'Hotspot Detection', desc: 'Statistical signal when digit hot (>12%). Conservative threshold 75%.' },
  { id: 'over_under', label: 'Over/Under Hybrid', desc: 'Disabled by default — extra statistical overlay. Enable only if you want more trades.' },
];

export function AIBotPanel({
  isOpen, onClose, isRunning, config, activities, signals,
  tradeHistory, dailyStats, lastAnalysis, emergencyStop,
  onStart, onStop, onUpdateConfig, onEmergencyStop, onResetEmergencyStop,
  balance, tickCount, currentSymbol, isConnected,
  validation, drawdown, onRunValidation, onRunBacktest, strategyHealth,
}: AIBotPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [settingsExpanded, setSettingsExpanded] = useState<Record<string, boolean>>({
    trade: true, strategy: false, risk: false, markets: false, marketMode: false,
  });
  const signalsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    signalsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [signals.length]);

  if (!isOpen) return null;

  const formatCurrency = (val: number) => `$${val.toFixed(2)}`;
  const formatPct = (val: number) => `${val.toFixed(1)}%`;
  const winRate = tradeHistory.length > 0
    ? (tradeHistory.filter(t => t.result === 'WIN').length / tradeHistory.filter(t => t.result !== 'PENDING').length || 0) * 100
    : 0;
  const pnl = tradeHistory.reduce((sum, t) => sum + (t.profit ?? 0), 0);
  const wins = tradeHistory.filter(t => t.result === 'WIN').length;
  const losses = tradeHistory.filter(t => t.result === 'LOSS').length;
  const pending = tradeHistory.filter(t => t.result === 'PENDING').length;

  const getSignalColor = (confidence: number) => {
    if (confidence >= 75) return 'text-emerald-500';
    if (confidence >= 55) return 'text-yellow-500';
    return 'text-orange-400';
  };

  const getSignalBg = (confidence: number) => {
    if (confidence >= 75) return 'bg-emerald-500/10 border-emerald-500/30';
    if (confidence >= 55) return 'bg-yellow-500/10 border-yellow-500/30';
    return 'bg-orange-500/10 border-orange-500/30';
  };

  const getReasonIcon = (reason: string) => {
    if (reason.includes('Hot') || reason.includes('hot')) return <TrendingUp className="h-3 w-3 text-emerald-400" />;
    if (reason.includes('Cold') || reason.includes('cold')) return <TrendingDown className="h-3 w-3 text-blue-400" />;
    if (reason.includes('Over 2') || reason.includes('over')) return <Minus className="h-3 w-3 text-yellow-400" />;
    if (reason.includes('Under 8') || reason.includes('under')) return <Plus className="h-3 w-3 text-purple-400" />;
    if (reason.includes('Trend') || reason.includes('trend')) return <Activity className="h-3 w-3 text-cyan-400" />;
    return <Target className="h-3 w-3 text-orange-400" />;
  };

  const toggleMarket = (marketId: string) => {
    const current = config.markets ?? [];
    const updated = current.includes(marketId) ? current.filter(m => m !== marketId) : [...current, marketId];
    onUpdateConfig({ markets: updated });
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-background w-full h-full">
      <div className="flex items-center justify-between border-b px-3 py-2 sm:px-6 sm:py-3 shrink-0">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", isRunning ? "bg-emerald-500" : "bg-muted")}>
            <Zap className="h-4 w-4 text-white" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm sm:text-base font-bold truncate">AI Bot</h2>
            <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs text-muted-foreground">
              {isConnected ? (
                <><Wifi className="h-3 w-3 text-emerald-500" /><span className="text-emerald-500">Connected</span></>
              ) : (
                <><WifiOff className="h-3 w-3 text-red-500" /><span className="text-red-500">Offline</span></>
              )}
              {currentSymbol && (
                <Badge variant="secondary" className="text-[10px] sm:text-xs px-1 sm:px-1.5 py-0">
                  {currentSymbol.replace('volatility_', 'V').replace('Boom', 'B').replace('Crash', 'C').replace('Jump', 'J').replace('1000', '1k').replace('500', '5h').replace('300', '3h')}
                </Badge>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {emergencyStop && (
            <Button variant="destructive" size="sm" onClick={onResetEmergencyStop} className="h-8 px-2 sm:px-3 text-xs">
              <RefreshCw className="h-3.5 w-3.5 sm:mr-1" /><span>Reset</span>
            </Button>
          )}
          <Button
            variant={isRunning ? 'destructive' : 'default'}
            size="sm"
            onClick={isRunning ? onStop : onStart}
            className={cn("h-8 px-2 sm:px-3 text-xs", isRunning ? '' : 'bg-emerald-600 hover:bg-emerald-700')}
          >
            {isRunning ? <><Pause className="h-3.5 w-3.5 sm:mr-1" /><span>Stop</span></> : <><Play className="h-3.5 w-3.5 sm:mr-1" /><span>Start</span></>}
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex border-b px-2 sm:px-6 shrink-0 overflow-x-auto">
        {([['dashboard', BarChart3, 'Dashboard'], ['signals', Zap, 'Signals'], ['history', History, 'History'], ['settings', Settings, 'Settings']] as [Tab, typeof BarChart3, string][]).map(([tab, Icon, label]) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "flex items-center gap-1.5 px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
              activeTab === tab ? "border-emerald-500 text-emerald-600" : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="p-3 sm:p-4 space-y-3 sm:space-y-4">

          {activeTab === 'dashboard' && (
            <>
              <Card className="bg-amber-500/5 border-amber-500/20">
                <CardContent className="p-2.5 flex items-start gap-2">
                  <Shield className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                  <p className="text-[11px] leading-snug text-muted-foreground">
                    <span className="font-semibold text-amber-600">Production mode:</span> Uses <span className="font-medium">real Deriv ticks</span> and your Settings (stake ${config.stake.toFixed(2)} • duration {config.duration} tick • min confidence {Math.round(config.confidenceThreshold*100)}%). No digit strategy can guarantee profit — digits are pseudo-random. Bot trades <span className="font-medium">only high-confidence</span> Assured Over 2 / Under 8 (≥85% + 3/10 confirmation) and pauses on {config.maxConsecutiveLosses} consecutive losses or ${config.maxDailyLoss} daily loss. Expect wins <em>and</em> losses.
                  </p>
                </CardContent>
              </Card>
              <Card className="bg-card/50 border-emerald-500/20">
                <CardHeader className="p-3 pb-2">
                  <CardTitle className="text-xs flex items-center gap-2">
                    <BarChart3 className="h-3.5 w-3.5 text-emerald-500" /> Validated Strategy — Backtest + Out-of-Sample
                    <Badge variant={validation?.isValid ? 'default' : 'secondary'} className={cn("ml-auto text-[10px]", validation?.isValid ? "bg-emerald-500" : "bg-amber-500/20 text-amber-600 border")}>{validation ? (validation.isValid ? "VALIDATED" : "NOT VALIDATED") : "NOT RUN"}</Badge>
                  </CardTitle>
                  <p className="text-[10px] text-muted-foreground">70% in-sample / 30% out-of-sample • Requires OOS winRate ≥52%, PF &gt;1, gap &lt;15% • Demo before live • No overfitting</p>
                </CardHeader>
                <CardContent className="p-3 pt-0 space-y-2">
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="h-7 text-xs flex-1" onClick={() => onRunBacktest?.()}>Run Backtest</Button>
                    <Button variant="default" size="sm" className="h-7 text-xs flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={() => onRunValidation?.()}>Run Validation (OOS)</Button>
                  </div>
                  {validation ? (
                    <div className="grid grid-cols-3 gap-2 text-[11px]">
                      <div className="rounded bg-muted p-2 text-center"><div className="text-muted-foreground">IS winRate</div><div className="font-bold">{(validation.inSample.winRate*100).toFixed(1)}%<span className="font-normal text-muted-foreground"> ({validation.inSample.totalTrades})</span></div><div className="text-[10px]">PF {validation.inSample.profitFactor.toFixed(2)}</div></div>
                      <div className="rounded bg-muted p-2 text-center"><div className="text-muted-foreground">OOS winRate</div><div className="font-bold">{(validation.outOfSample.winRate*100).toFixed(1)}%<span className="font-normal text-muted-foreground"> ({validation.outOfSample.totalTrades})</span></div><div className="text-[10px]">PF {validation.outOfSample.profitFactor.toFixed(2)}</div></div>
                      <div className={cn("rounded p-2 text-center", validation.isValid ? "bg-emerald-500/10 border border-emerald-500/30" : "bg-amber-500/10 border border-amber-500/30")}><div className="text-muted-foreground">Gap</div><div className="font-bold">{(validation.gap*100).toFixed(1)}%</div><div className="text-[10px] truncate">{validation.reason}</div></div>
                    </div>
                  ) : <p className="text-[11px] text-muted-foreground">Run validation on collected ticks (needs ≥80 ticks). Live trading is safest after “VALIDATED” + demo.</p>}
                  {drawdown && <div className="flex gap-2 text-[10px] text-muted-foreground"><span>Drawdown: <b className={drawdown.current>0? "text-red-500":""}>${drawdown.current.toFixed(2)}</b> / max ${drawdown.max.toFixed(2)}</span><span>•</span><span>Peak PnL ${drawdown.peak.toFixed(2)}</span></div>}
                  <p className="text-[10px] text-muted-foreground">Pre-trade check: bot verifies <b>EV&gt;0</b> (payout−stake) at signal confidence before each buy — blocks blind trades. Continuously learns from live PnL (regularized) and remains inactive when risk &gt; threshold.</p>
                </CardContent>
              </Card>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                {[
                  { label: 'Balance', value: formatCurrency(balance), icon: DollarSign, color: 'text-emerald-500' },
                  { label: 'P/L', value: formatCurrency(pnl), icon: pnl >= 0 ? TrendingUp : TrendingDown, color: pnl >= 0 ? 'text-emerald-500' : 'text-red-500' },
                  { label: 'Win Rate', value: formatPct(winRate), icon: Target, color: 'text-blue-500' },
                  { label: 'Wins', value: `${wins}W / ${losses}L${pending > 0 ? ` / ${pending}P` : ''}`, icon: BarChart3, color: 'text-emerald-500' },
                  { label: 'Signals', value: String(signals.length), icon: Zap, color: 'text-yellow-500' },
                  { label: 'Ticks', value: String(tickCount), icon: Activity, color: 'text-cyan-500' },
                  { label: 'Streak', value: `${Math.abs(dailyStats.currentStreak)}${dailyStats.currentStreak > 0 ? 'W' : 'L'}`, icon: TrendingUp, color: dailyStats.currentStreak > 0 ? 'text-emerald-500' : 'text-red-500' },
                  { label: 'Daily', value: formatCurrency(dailyStats.dailyPnL), icon: DollarSign, color: dailyStats.dailyPnL >= 0 ? 'text-emerald-500' : 'text-red-500' },
                ].map(({ label, value, icon: Icon, color }) => (
                  <Card key={label} className="bg-card/50">
                    <CardContent className="p-2.5 sm:p-3">
                      <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
                        <Icon className={cn("h-3.5 w-3.5", color)} />
                        <span className="text-xs text-muted-foreground">{label}</span>
                      </div>
                      <div className={cn("text-base sm:text-lg font-bold", color)}>{value}</div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {config.over2Enabled && (
                  <Card className={cn("border-yellow-500/30", strategyHealth?.get('over2')?.enabled === false ? "bg-red-500/5 border-red-500/30" : "bg-yellow-500/5")}>
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Minus className="h-4 w-4 text-yellow-500" />
                        <span className="text-sm font-bold text-yellow-500">Over 2 Strategy</span>
                        {strategyHealth?.get('over2')?.enabled === false ? (
                          <Badge variant="destructive" className="ml-auto text-[10px]">SUSPENDED</Badge>
                        ) : (
                          <Badge variant="default" className="ml-auto text-[10px] bg-yellow-500">ACTIVE</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">Auto-trade DIGITOVER 2 when last 2 digits are 0 or 1</p>
                      {strategyHealth?.get('over2')?.suspendedReason && <p className="text-[11px] text-red-500 mt-1">{strategyHealth?.get('over2')?.suspendedReason} • {((strategyHealth?.get('over2')?.winRate ?? 0)*100).toFixed(1)}% ({strategyHealth?.get('over2')?.trades ?? 0}) PF {(strategyHealth?.get('over2')?.profitFactor ?? 0).toFixed(2)}</p>}
                      {(strategyHealth?.get('over2')?.enabled !== false && (strategyHealth?.get('over2')?.trades ?? 0) > 0) && <p className="text-[11px] text-muted-foreground mt-1">Live: {((strategyHealth?.get('over2')?.winRate ?? 0)*100).toFixed(1)}% ({strategyHealth?.get('over2')?.trades ?? 0}) PF {(strategyHealth?.get('over2')?.profitFactor ?? 0).toFixed(2)}</p>}
                    </CardContent>
                  </Card>
                )}
                {config.under8Enabled && (
                  <Card className={cn("border-purple-500/30", strategyHealth?.get('under8')?.enabled === false ? "bg-red-500/5 border-red-500/30" : "bg-purple-500/5")}>
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Plus className="h-4 w-4 text-purple-500" />
                        <span className="text-sm font-bold text-purple-500">Under 8 Strategy</span>
                        {strategyHealth?.get('under8')?.enabled === false ? (
                          <Badge variant="destructive" className="ml-auto text-[10px]">SUSPENDED</Badge>
                        ) : (
                          <Badge variant="default" className="ml-auto text-[10px] bg-purple-500">ACTIVE</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">Auto-trade DIGITUNDER 8 when last 2 digits are 8 or 9 and combined freq &lt; 10%</p>
                      {strategyHealth?.get('under8')?.suspendedReason && <p className="text-[11px] text-red-500 mt-1">{strategyHealth?.get('under8')?.suspendedReason} • {((strategyHealth?.get('under8')?.winRate ?? 0)*100).toFixed(1)}% ({strategyHealth?.get('under8')?.trades ?? 0}) PF {(strategyHealth?.get('under8')?.profitFactor ?? 0).toFixed(2)}</p>}
                      {(strategyHealth?.get('under8')?.enabled !== false && (strategyHealth?.get('under8')?.trades ?? 0) > 0) && <p className="text-[11px] text-muted-foreground mt-1">Live: {((strategyHealth?.get('under8')?.winRate ?? 0)*100).toFixed(1)}% ({strategyHealth?.get('under8')?.trades ?? 0}) PF {(strategyHealth?.get('under8')?.profitFactor ?? 0).toFixed(2)}</p>}
                    </CardContent>
                  </Card>
                )}
              </div>
              {strategyHealth?.get('stat')?.enabled === false && (
                <Card className="bg-red-500/5 border-red-500/30">
                  <CardContent className="p-2.5 text-[11px] text-red-600">Stat strategy suspended: {strategyHealth?.get('stat')?.suspendedReason} — bot will stay inactive on statistical signals until OOS re-validates (auto every 90s).</CardContent>
                </Card>
              )}

              {lastAnalysis && (
                <Card className="bg-card/50 border-emerald-500/20">
                  <CardHeader className="p-3 sm:p-4 pb-2">
                    <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                      <Activity className="h-4 w-4 text-emerald-500" />
                      Real Digit Dominance — Live Scan
                      <Badge variant="secondary" className="ml-auto text-[10px]">{lastAnalysis.symbol}</Badge>
                    </CardTitle>
                    <p className="text-[11px] text-muted-foreground">Live ticks: {lastAnalysis.digitStats.totalTicks} • Expected per digit: 10% • Bars show real % from Deriv ticks (pip-accurate)</p>
                  </CardHeader>
                  <CardContent className="p-3 sm:p-4 pt-0 space-y-3">
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-2">
                        <div className="text-[10px] text-muted-foreground">Dominant</div>
                        <div className="text-xl font-bold text-emerald-500">{lastAnalysis.dominantDigit} <span className="text-xs font-normal">{lastAnalysis.digitFrequencies[lastAnalysis.dominantDigit]?.[1].toFixed(1)}%</span></div>
                      </div>
                      <div className="rounded-lg bg-muted p-2">
                        <div className="text-[10px] text-muted-foreground">Entropy</div>
                        <div className="text-xl font-bold">{lastAnalysis.entropy.toFixed(2)}</div>
                        <div className="text-[10px] text-muted-foreground">{lastAnalysis.entropy < 3.1 ? 'Low = skewed' : 'High = random'}</div>
                      </div>
                      <div className="rounded-lg bg-muted p-2">
                        <div className="text-[10px] text-muted-foreground">Last Digit</div>
                        <div className="text-xl font-bold">{lastAnalysis.lastDigit}</div>
                        <div className="text-[10px] text-muted-foreground truncate">{lastAnalysis.symbol.split('_').pop()}</div>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      {lastAnalysis.digitFrequencies.map(([digit, freq]) => {
                        const isDom = digit === lastAnalysis.dominantDigit;
                        const isHot = freq > 12;
                        const isCold = freq < 7;
                        const barWidth = Math.min(100, (freq / 16) * 100);
                        return (
                          <div key={digit} className="flex items-center gap-2 text-xs">
                            <span className={cn("w-5 font-mono font-bold", isDom ? "text-emerald-500" : isHot ? "text-amber-500" : isCold ? "text-blue-500" : "")}>{digit}</span>
                            <div className="flex-1 h-4 rounded bg-muted relative overflow-hidden">
                              <div className={cn("h-full rounded transition-all", isDom ? "bg-emerald-500" : isHot ? "bg-amber-500" : isCold ? "bg-blue-500" : "bg-foreground/60")} style={{ width: `${barWidth}%` }} />
                              <div className="absolute inset-0 flex items-center px-1.5 text-[10px] font-medium mix-blend-difference text-white">{freq.toFixed(1)}%</div>
                              <div className="absolute top-0 bottom-0 w-px bg-red-500/70" style={{ left: `${(10/16)*100}%` }} title="10% expected" />
                            </div>
                            <span className="w-12 text-right font-mono text-[11px] text-muted-foreground">{freq.toFixed(1)}%</span>
                            {isHot && <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-amber-500/40 text-amber-600">HOT</Badge>}
                            {isCold && <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-blue-500/40 text-blue-600">COLD</Badge>}
                          </div>
                        );
                      })}
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground pt-1">
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-red-500/70 inline-block" /> 10% expected</span>
                        <span>•</span><span>Bar = real Dominance from live ticks</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card className="bg-card/50">
                <CardHeader className="p-3 sm:p-4 pb-2">
                  <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                    <Zap className="h-4 w-4 text-yellow-500" />
                    Recent Signals
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3 sm:p-4 pt-0 space-y-2 max-h-64 overflow-y-auto">
                  {signals.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      {isRunning ? 'Scanning markets...' : 'Start bot to receive signals'}
                    </div>
                  ) : (
                    signals.slice(-10).reverse().map((sig, i) => (
                      <div key={sig.id || i} className={cn("flex items-center justify-between rounded-lg border p-2.5", getSignalBg(sig.confidence))}>
                        <div className="flex items-center gap-2 min-w-0">
                          {getReasonIcon(sig.reasonForEntry)}
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-base">{sig.predictedDigit ?? '-'}</span>
                              <Badge variant="outline" className="text-[10px] px-1">{sig.signalType}</Badge>
                              <Badge variant="secondary" className="text-[10px] px-1">{sig.contractMode}</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground truncate">{sig.reasonForEntry}</p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className={cn("text-sm font-bold", getSignalColor(sig.confidence))}>{formatPct(sig.confidence * 100)}</div>
                          <div className="text-[10px] text-muted-foreground">{sig.symbol.split('_').pop()}</div>
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={signalsEndRef} />
                </CardContent>
              </Card>
            </>
          )}

          {activeTab === 'signals' && (
            <div className="space-y-2 sm:space-y-3">
              {signals.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground text-sm">
                  {isRunning ? 'Scanning markets for signals...' : 'Start the bot to begin signal detection'}
                </div>
              ) : (
                signals.slice(-30).reverse().map((sig, i) => (
                  <Card key={sig.id || i} className={cn("border", getSignalBg(sig.confidence))}>
                    <CardContent className="p-3 sm:p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3 min-w-0">
                          {getReasonIcon(sig.reasonForEntry)}
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xl sm:text-2xl font-bold">{sig.predictedDigit ?? '-'}</span>
                              <Badge variant={sig.signalType === 'STRONG_BUY' || sig.signalType === 'BUY' ? 'default' : 'secondary'} className="text-xs">
                                {sig.signalType}
                              </Badge>
                              <Badge variant="outline" className="text-xs">{sig.contractMode}</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">{sig.reasonForEntry}</p>
                            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
                              <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {new Date(sig.timestamp).toLocaleTimeString()}</span>
                              <span>{sig.symbol}</span>
                              {sig.marketCondition && <span className="font-mono">{sig.marketCondition}</span>}
                            </div>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className={cn("text-lg sm:text-xl font-bold", getSignalColor(sig.confidence))}>{formatPct(sig.confidence * 100)}</div>
                          <div className="text-xs text-muted-foreground">confidence</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-2 sm:space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <Card className="bg-card/50">
                  <CardContent className="p-3">
                    <div className="text-xs text-muted-foreground mb-1">Today&apos;s P/L</div>
                    <div className={cn("text-lg font-bold", dailyStats.dailyPnL >= 0 ? 'text-emerald-500' : 'text-red-500')}>{formatCurrency(dailyStats.dailyPnL)}</div>
                  </CardContent>
                </Card>
                <Card className="bg-card/50">
                  <CardContent className="p-3">
                    <div className="text-xs text-muted-foreground mb-1">Win Streak</div>
                    <div className="text-lg font-bold text-blue-500">{dailyStats.currentStreak}</div>
                  </CardContent>
                </Card>
              </div>

              {tradeHistory.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground text-sm">No trades yet</div>
              ) : (
                tradeHistory.slice(-50).reverse().map((trade, i) => (
                  <Card key={trade.id || i} className={cn(
                    "bg-card/50",
                    trade.result === 'WIN' && "border-emerald-500/30",
                    trade.result === 'LOSS' && "border-red-500/30",
                  )}>
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold">{trade.digit ?? '-'}</span>
                            <Badge
                              variant={trade.result === 'WIN' ? 'default' : trade.result === 'LOSS' ? 'destructive' : 'secondary'}
                              className={cn(
                                "text-[10px]",
                                trade.result === 'WIN' && "bg-emerald-500 hover:bg-emerald-600",
                                trade.result === 'PENDING' && "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
                              )}
                            >
                              {trade.result === 'PENDING' ? 'PENDING' : trade.result}
                            </Badge>
                            <Badge variant="outline" className="text-[10px]">{trade.contractMode}</Badge>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                            <span>{new Date(trade.timestamp).toLocaleTimeString()}</span>
                            <span>{trade.symbol}</span>
                            <span>${trade.stake.toFixed(2)}</span>
                            {trade.signalConfidence > 0 && <span>{trade.signalConfidence.toFixed(0)}%</span>}
                          </div>
                        </div>
                        <div className={cn(
                          "text-sm sm:text-base font-bold",
                          trade.result === 'WIN' ? 'text-emerald-500' : trade.result === 'LOSS' ? 'text-red-500' : 'text-yellow-400'
                        )}>
                          {trade.result === 'PENDING' ? '...' : `${trade.profit >= 0 ? '+' : ''}$${trade.profit.toFixed(2)}`}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-3">
              <Card className="bg-card/50">
                <button onClick={() => setSettingsExpanded(p => ({ ...p, trade: !p.trade }))} className="flex items-center justify-between w-full p-3 sm:p-4">
                  <CardTitle className="text-sm flex items-center gap-2"><DollarSign className="h-4 w-4 text-emerald-500" /> Trade Settings</CardTitle>
                  {settingsExpanded.trade ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                {settingsExpanded.trade && (
                  <CardContent className="px-3 pb-3 sm:px-4 sm:pb-4 pt-0 space-y-3">
                    <div className="space-y-1.5">
                      <label className="text-xs text-muted-foreground">Stake Amount ($)</label>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => onUpdateConfig({ stake: Math.max(0.35, config.stake - 0.5) })}><Minus className="h-3 w-3" /></Button>
                        <input type="number" value={config.stake} onChange={e => onUpdateConfig({ stake: Math.max(0.35, parseFloat(e.target.value) || 0.35) })} className="h-8 rounded border bg-background px-2 text-center text-sm w-20" step="0.5" min="0.35" />
                        <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => onUpdateConfig({ stake: config.stake + 0.5 })}><Plus className="h-3 w-3" /></Button>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs text-muted-foreground">Target Profit ($)</label>
                      <input type="number" value={config.targetProfit} onChange={e => onUpdateConfig({ targetProfit: parseFloat(e.target.value) || 5 })} className="h-8 w-full rounded border bg-background px-2 text-sm" step="1" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs text-muted-foreground">Stop Loss ($)</label>
                      <input type="number" value={config.stopLoss} onChange={e => onUpdateConfig({ stopLoss: parseFloat(e.target.value) || 20 })} className="h-8 w-full rounded border bg-background px-2 text-sm" step="1" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1.5">
                        <label className="text-xs text-muted-foreground">Duration (ticks)</label>
                        <input type="number" value={config.duration} onChange={e => onUpdateConfig({ duration: parseInt(e.target.value) || 5 })} className="h-8 w-full rounded border bg-background px-2 text-sm" min="1" max="100" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs text-muted-foreground">Max Daily Trades</label>
                        <input type="number" value={config.maxDailyTrades} onChange={e => onUpdateConfig({ maxDailyTrades: parseInt(e.target.value) || 50 })} className="h-8 w-full rounded border bg-background px-2 text-sm" min="1" />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs text-muted-foreground">Min Confidence</label>
                      <div className="flex items-center gap-2">
                        <input type="range" min="0.3" max="0.95" step="0.05" value={config.confidenceThreshold} onChange={e => onUpdateConfig({ confidenceThreshold: parseFloat(e.target.value) })} className="flex-1" />
                        <span className="text-xs font-mono w-12 text-right">{formatPct(config.confidenceThreshold * 100)}</span>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs text-muted-foreground">Min Tick Interval (ms)</label>
                      <input type="number" value={config.minTickInterval} onChange={e => onUpdateConfig({ minTickInterval: parseInt(e.target.value) || 500 })} className="h-8 w-full rounded border bg-background px-2 text-sm" min="200" step="100" />
                    </div>
                  </CardContent>
                )}
              </Card>

              <Card className="bg-card/50">
                <button onClick={() => setSettingsExpanded(p => ({ ...p, strategy: !p.strategy }))} className="flex items-center justify-between w-full p-3 sm:p-4">
                  <CardTitle className="text-sm flex items-center gap-2"><Target className="h-4 w-4 text-purple-500" /> Strategies</CardTitle>
                  {settingsExpanded.strategy ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                {settingsExpanded.strategy && (
                  <CardContent className="px-3 pb-3 sm:px-4 sm:pb-4 pt-0 space-y-2">
                    {STRATEGIES.map(s => {
                      let isEnabled = false;
                      if (s.id === 'over2') isEnabled = config.over2Enabled;
                      else if (s.id === 'under8') isEnabled = config.under8Enabled;
                      else if (s.id === 'evenOdd') isEnabled = config.evenOddEnabled;
                      else if (s.id === 'evenStreak') isEnabled = config.evenStreakEnabled;
                      else if (s.id === 'oddStreak') isEnabled = config.oddStreakEnabled;
                      else if (s.id === 'over3under6') isEnabled = config.over3Under6Enabled;
                      else if (s.id === 'over_under') isEnabled = config.overUnderStrategy;
                      else isEnabled = (config.strategies ?? []).includes(s.id);

                      return (
                        <div key={s.id} className="flex items-center justify-between p-2 rounded border">
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium">{s.label}</div>
                            <div className="text-xs text-muted-foreground">{s.desc}</div>
                          </div>
                          <input
                            type="checkbox"
                            checked={isEnabled}
                            onChange={() => {
                              if (s.id === 'over2') onUpdateConfig({ over2Enabled: !config.over2Enabled });
                              else if (s.id === 'under8') onUpdateConfig({ under8Enabled: !config.under8Enabled });
                              else if (s.id === 'evenOdd') onUpdateConfig({ evenOddEnabled: !config.evenOddEnabled });
                              else if (s.id === 'evenStreak') onUpdateConfig({ evenStreakEnabled: !config.evenStreakEnabled });
                              else if (s.id === 'oddStreak') onUpdateConfig({ oddStreakEnabled: !config.oddStreakEnabled });
                              else if (s.id === 'over3under6') onUpdateConfig({ over3Under6Enabled: !config.over3Under6Enabled });
                              else if (s.id === 'over_under') onUpdateConfig({ overUnderStrategy: !config.overUnderStrategy });
                              else {
                                const current = config.strategies ?? [];
                                const updated = current.includes(s.id) ? current.filter(x => x !== s.id) : [...current, s.id];
                                onUpdateConfig({ strategies: updated });
                              }
                            }}
                            className="h-4 w-4 accent-emerald-500 shrink-0 ml-2"
                          />
                        </div>
                      );
                    })}
                  </CardContent>
                )}
              </Card>

              <Card className="bg-card/50">
                <button onClick={() => setSettingsExpanded(p => ({ ...p, marketMode: !p.marketMode }))} className="flex items-center justify-between w-full p-3 sm:p-4">
                  <CardTitle className="text-sm flex items-center gap-2"><Activity className="h-4 w-4 text-blue-500" /> Market & Recovery</CardTitle>
                  {settingsExpanded.marketMode ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                {settingsExpanded.marketMode && (
                  <CardContent className="px-3 pb-3 sm:px-4 sm:pb-4 pt-0 space-y-3">
                    <div className="space-y-1.5">
                      <label className="text-xs text-muted-foreground">Bot Trade Market (AI chooses within this)</label>
                      <select value={config.tradeMode} onChange={e => onUpdateConfig({ tradeMode: e.target.value as BotConfig['tradeMode'] })} className="h-8 w-full rounded border bg-background px-2 text-sm">
                        <option value="all">All — AI scans Over/Under + Even/Odd (recommended)</option>
                        <option value="overUnder">Over/Under only — disables Even/Odd</option>
                        <option value="evenOdd">Even/Odd only — disables Over/Under</option>
                      </select>
                      <p className="text-[11px] text-muted-foreground">Upload-verified: Over 3/Under 6 and Even/Odd streaks are production strategies (pip-accurate, real ticks).</p>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium">Split-Martingale Recovery</div>
                        <div className="text-xs text-muted-foreground">From uploaded bots — recovers debt with stake = ROUNDUP(debt/(split×returnRate)*100)/100, min 0.35</div>
                      </div>
                      <input type="checkbox" checked={config.splitMartingaleEnabled} onChange={() => onUpdateConfig({ splitMartingaleEnabled: !config.splitMartingaleEnabled })} className="h-4 w-4 accent-emerald-500" />
                    </div>
                    {config.splitMartingaleEnabled && (
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">Split Factor</label>
                          <input type="number" value={config.splitFactor} onChange={e => onUpdateConfig({ splitFactor: Math.max(1, parseInt(e.target.value) || 1) })} className="h-8 w-full rounded border bg-background px-2 text-sm" min="1" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">Return Rate</label>
                          <input type="number" value={config.returnRate} onChange={e => onUpdateConfig({ returnRate: parseFloat(e.target.value) || 0.54 })} className="h-8 w-full rounded border bg-background px-2 text-sm" step="0.01" min="0.1" max="1" />
                        </div>
                      </div>
                    )}
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Streak Length (for Even/Odd)</label>
                      <input type="number" value={config.streakLength} onChange={e => onUpdateConfig({ streakLength: Math.max(2, Math.min(5, parseInt(e.target.value) || 3)) })} className="h-8 w-full rounded border bg-background px-2 text-sm" min="2" max="5" />
                    </div>
                  </CardContent>
                )}
              </Card>

              <Card className="bg-card/50">
                <button onClick={() => setSettingsExpanded(p => ({ ...p, risk: !p.risk }))} className="flex items-center justify-between w-full p-3 sm:p-4">
                  <CardTitle className="text-sm flex items-center gap-2"><Shield className="h-4 w-4 text-red-500" /> Risk Management</CardTitle>
                  {settingsExpanded.risk ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                {settingsExpanded.risk && (
                  <CardContent className="px-3 pb-3 sm:px-4 sm:pb-4 pt-0 space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1.5">
                        <label className="text-xs text-muted-foreground">Max Consecutive Losses</label>
                        <input type="number" value={config.maxConsecutiveLosses} onChange={e => onUpdateConfig({ maxConsecutiveLosses: parseInt(e.target.value) || 5 })} className="h-8 w-full rounded border bg-background px-2 text-sm" min="1" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs text-muted-foreground">Max Daily Loss ($)</label>
                        <input type="number" value={config.maxDailyLoss} onChange={e => onUpdateConfig({ maxDailyLoss: parseFloat(e.target.value) || 50 })} className="h-8 w-full rounded border bg-background px-2 text-sm" step="5" />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs text-muted-foreground">Max Daily Profit ($)</label>
                      <input type="number" value={config.maxDailyProfit} onChange={e => onUpdateConfig({ maxDailyProfit: parseFloat(e.target.value) || 100 })} className="h-8 w-full rounded border bg-background px-2 text-sm" step="5" />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Auto Trade</span>
                      <input type="checkbox" checked={config.autoTrade} onChange={() => onUpdateConfig({ autoTrade: !config.autoTrade })} className="h-5 w-5 accent-emerald-500" />
                    </div>
                  </CardContent>
                )}
              </Card>

              <Card className="bg-card/50">
                <button onClick={() => setSettingsExpanded(p => ({ ...p, markets: !p.markets }))} className="flex items-center justify-between w-full p-3 sm:p-4">
                  <CardTitle className="text-sm flex items-center gap-2"><Activity className="h-4 w-4 text-cyan-500" /> Markets</CardTitle>
                  {settingsExpanded.markets ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                {settingsExpanded.markets && (
                  <CardContent className="px-3 pb-3 sm:px-4 sm:pb-4 pt-0">
                    <div className="flex flex-wrap gap-1.5">
                      {ALL_MARKETS.map(m => (
                        <Badge
                          key={m.id}
                          variant={(config.markets ?? []).includes(m.id) ? 'default' : 'outline'}
                          className="cursor-pointer text-xs"
                          onClick={() => toggleMarket(m.id)}
                        >
                          {m.label}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                )}
              </Card>

              {emergencyStop && (
                <Card className="border-red-500/50 bg-red-500/10">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-red-500 mb-2">
                      <AlertTriangle className="h-5 w-5" />
                      <span className="font-bold">Emergency Stop Active</span>
                    </div>
                    <p className="text-xs text-red-400 mb-3">Bot has been stopped due to consecutive losses or daily loss limit.</p>
                    <Button variant="destructive" size="sm" onClick={onResetEmergencyStop}>
                      <RefreshCw className="h-3.5 w-3.5 mr-1" /> Reset and Continue
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
