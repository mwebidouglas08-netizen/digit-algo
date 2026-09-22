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
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { BotConfig, BotActivity, Signal, TradeRecord, DailyStats, MarketAnalysis } from './ai-bot-engine';

interface AIBotPanelProps {
  isOpen: boolean;
  onClose: () => void;
  isRunning: boolean;
  config: BotConfig;
  activities: BotActivity[];
  signals: Signal[];
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
  { id: 'hotspot', label: 'Hotspot Detection', desc: 'Buy when a digit appears more than expected' },
  { id: 'mean_reversion', label: 'Mean Reversion', desc: 'Buy when a digit is overdue (cold)' },
  { id: 'trend_following', label: 'Trend Following', desc: 'Follow the most common digit pattern' },
  { id: 'over_under', label: 'Over/Under Hybrid', desc: 'Use Over/Under analysis to guide digit picks' },
];

export function AIBotPanel({
  isOpen, onClose, isRunning, config, activities, signals,
  tradeHistory, dailyStats, lastAnalysis, emergencyStop,
  onStart, onStop, onUpdateConfig, onEmergencyStop, onResetEmergencyStop,
  balance, tickCount, currentSymbol, isConnected,
}: AIBotPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [settingsExpanded, setSettingsExpanded] = useState<Record<string, boolean>>({
    trade: true, strategy: false, risk: false, markets: false,
  });
  const signalsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    signalsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [signals.length]);

  if (!isOpen) return null;

  const formatCurrency = (val: number) => `$${val.toFixed(2)}`;
  const formatPct = (val: number) => `${val.toFixed(1)}%`;
  const winRate = tradeHistory.length > 0
    ? (tradeHistory.filter(t => t.result === 'win').length / tradeHistory.length) * 100
    : 0;
  const pnl = tradeHistory.reduce((sum, t) => sum + (t.profit ?? 0), 0);

  const getSignalColor = (confidence: number) => {
    if (confidence >= 0.75) return 'text-emerald-500';
    if (confidence >= 0.55) return 'text-yellow-500';
    return 'text-orange-400';
  };

  const getSignalBg = (confidence: number) => {
    if (confidence >= 0.75) return 'bg-emerald-500/10 border-emerald-500/30';
    if (confidence >= 0.55) return 'bg-yellow-500/10 border-yellow-500/30';
    return 'bg-orange-500/10 border-orange-500/30';
  };

  const getReasonIcon = (reason: string) => {
    if (reason.includes('Hot') || reason.includes('hot')) return <TrendingUp className="h-3 w-3 text-emerald-400" />;
    if (reason.includes('Cold') || reason.includes('cold')) return <TrendingDown className="h-3 w-3 text-blue-400" />;
    if (reason.includes('Trend') || reason.includes('trend')) return <Activity className="h-3 w-3 text-purple-400" />;
    if (reason.includes('Over') || reason.includes('over')) return <Minus className="h-3 w-3 text-yellow-400" />;
    return <Target className="h-3 w-3 text-orange-400" />;
  };

  const toggleMarket = (marketId: string) => {
    const current = config.markets ?? ALL_MARKETS.map(m => m.id);
    const updated = current.includes(marketId)
      ? current.filter(m => m !== marketId)
      : [...current, marketId];
    onUpdateConfig({ markets: updated });
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <div className="flex items-center justify-between border-b px-3 py-2 sm:px-6 sm:py-3">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
            isRunning ? "bg-emerald-500" : "bg-muted"
          )}>
            <Zap className="h-4 w-4 text-white" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm sm:text-base font-bold truncate">AI Bot</h2>
            <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs text-muted-foreground">
              {isConnected ? (
                <><Wifi className="h-3 w-3 text-emerald-500" /><span className="text-emerald-500 hidden sm:inline">Connected</span></>
              ) : (
                <><WifiOff className="h-3 w-3 text-red-500" /><span className="text-red-500 hidden sm:inline">Offline</span></>
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
            <Button variant="destructive" size="sm" onClick={onResetEmergencyStop}
              className="h-8 px-2 sm:px-3 text-xs">
              <RefreshCw className="h-3.5 w-3.5 sm:mr-1" /><span className="hidden sm:inline">Reset</span>
            </Button>
          )}
          <Button
            variant={isRunning ? 'destructive' : 'default'}
            size="sm"
            onClick={isRunning ? onStop : onStart}
            className={cn("h-8 px-2 sm:px-3 text-xs",
              isRunning ? '' : 'bg-emerald-600 hover:bg-emerald-700'
            )}
          >
            {isRunning ? <><Pause className="h-3.5 w-3.5 sm:mr-1" /><span className="hidden sm:inline">Stop</span></> : <><Play className="h-3.5 w-3.5 sm:mr-1" /><span className="hidden sm:inline">Start</span></>}
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex border-b px-3 sm:px-6">
        {([['dashboard', BarChart3], ['signals', Zap], ['history', History], ['settings', Settings]] as [Tab, typeof BarChart3][]).map(([tab, Icon]) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-medium border-b-2 transition-colors",
              activeTab === tab
                ? "border-emerald-500 text-emerald-600"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span className="hidden xs:inline">{tab.charAt(0).toUpperCase() + tab.slice(1)}</span>
          </button>
        ))}
      </div>

      <ScrollArea className="flex-1 overflow-y-auto">
        <div className="p-3 sm:p-4 space-y-3 sm:space-y-4">
          {activeTab === 'dashboard' && (
            <>
              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                {[
                  { label: 'Balance', value: formatCurrency(balance), icon: DollarSign, color: 'text-emerald-500' },
                  { label: 'P/L', value: formatCurrency(pnl), icon: pnl >= 0 ? TrendingUp : TrendingDown, color: pnl >= 0 ? 'text-emerald-500' : 'text-red-500' },
                  { label: 'Win Rate', value: formatPct(winRate), icon: Target, color: 'text-blue-500' },
                  { label: 'Trades', value: String(tradeHistory.length), icon: BarChart3, color: 'text-purple-500' },
                  { label: 'Signals', value: String(signals.length), icon: Zap, color: 'text-yellow-500' },
                  { label: 'Ticks', value: String(tickCount), icon: Activity, color: 'text-cyan-500' },
                  { label: 'Streak', value: `${dailyStats.currentStreak}${dailyStats.currentStreak > 0 ? 'W' : 'L'}`, icon: TrendingUp, color: dailyStats.currentStreak > 0 ? 'text-emerald-500' : 'text-red-500' },
                  { label: 'Daily', value: formatCurrency(dailyStats.dailyPnL), icon: DollarSign, color: dailyStats.dailyPnL >= 0 ? 'text-emerald-500' : 'text-red-500' },
                ].map(({ label, value, icon: Icon, color }) => (
                  <Card key={label} className="bg-card/50">
                    <CardContent className="p-2.5 sm:p-3">
                      <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
                        <Icon className={cn("h-3 w-3 sm:h-3.5 sm:w-3.5", color)} />
                        <span className="text-[10px] sm:text-xs text-muted-foreground">{label}</span>
                      </div>
                      <div className={cn("text-sm sm:text-lg font-bold", color)}>{value}</div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {lastAnalysis && (
                <Card className="bg-card/50">
                  <CardHeader className="p-3 sm:p-4 pb-2">
                    <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                      <Activity className="h-4 w-4 text-emerald-500" />
                      Latest Analysis
                      <Badge variant="secondary" className="ml-auto text-[10px]">{lastAnalysis.symbol}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 sm:p-4 pt-0 space-y-2 sm:space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <span className="text-[10px] sm:text-xs text-muted-foreground">Dominant Digit</span>
                        <div className="text-xl sm:text-3xl font-bold text-emerald-500">{lastAnalysis.dominantDigit}</div>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] sm:text-xs text-muted-foreground">Entropy</span>
                        <div className="text-xl sm:text-3xl font-bold text-blue-500">{lastAnalysis.entropy.toFixed(3)}</div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {lastAnalysis.digitFrequencies.map(([digit, freq]) => (
                        <Badge
                          key={digit}
                          variant={digit === lastAnalysis.dominantDigit ? 'default' : 'secondary'}
                          className={cn(
                            "text-[10px] sm:text-xs px-1.5 sm:px-2",
                            digit === lastAnalysis.dominantDigit
                              ? "bg-emerald-500 text-white"
                              : freq > 12 ? "bg-red-500/20 text-red-400"
                              : freq < 8 ? "bg-blue-500/20 text-blue-400"
                              : ""
                          )}
                        >
                          {digit}: {freq}%
                        </Badge>
                      ))}
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
                <CardContent className="p-3 sm:p-4 pt-0 space-y-2 max-h-48 sm:max-h-64 overflow-y-auto">
                  {signals.length === 0 ? (
                    <div className="text-center py-6 sm:py-8 text-muted-foreground text-xs sm:text-sm">
                      {isRunning ? 'Scanning markets...' : 'Start bot to receive signals'}
                    </div>
                  ) : (
                    signals.slice(-10).reverse().map((sig, i) => (
                      <div key={sig.id || i} className={cn(
                        "flex items-center justify-between rounded-lg border p-2 sm:p-2.5",
                        getSignalBg(sig.confidence)
                      )}>
                        <div className="flex items-center gap-2 min-w-0">
                          {getReasonIcon(sig.reason)}
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-base sm:text-lg">{sig.digit}</span>
                              <Badge variant="outline" className="text-[10px] px-1">{sig.type}</Badge>
                            </div>
                            <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{sig.reason}</p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className={cn("text-xs sm:text-sm font-bold", getSignalColor(sig.confidence))}>
                            {formatPct(sig.confidence * 100)}
                          </div>
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
                <div className="text-center py-10 sm:py-16 text-muted-foreground text-xs sm:text-sm">
                  {isRunning ? 'Scanning markets for signals...' : 'Start the bot to begin signal detection'}
                </div>
              ) : (
                signals.slice(-20).reverse().map((sig, i) => (
                  <Card key={sig.id || i} className={cn("border", getSignalBg(sig.confidence))}>
                    <CardContent className="p-3 sm:p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                          {getReasonIcon(sig.reason)}
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                              <span className="text-xl sm:text-2xl font-bold">{sig.digit}</span>
                              <Badge variant={sig.type === 'BUY' ? 'default' : 'secondary'} className="text-[10px] sm:text-xs">
                                {sig.type}
                              </Badge>
                              {sig.type === 'OVER' || sig.type === 'UNDER' ? (
                                <Badge variant="outline" className="text-[10px] sm:text-xs">{sig.type} {sig.digit}</Badge>
                              ) : null}
                            </div>
                            <p className="text-xs sm:text-sm text-muted-foreground mt-1">{sig.reason}</p>
                            <div className="flex items-center gap-2 sm:gap-3 mt-1.5 sm:mt-2 text-[10px] sm:text-xs text-muted-foreground flex-wrap">
                              <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {sig.timestamp.toLocaleTimeString()}</span>
                              <span>{sig.symbol}</span>
                              <span className="font-mono">{sig.marketCondition}</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className={cn("text-lg sm:text-xl font-bold", getSignalColor(sig.confidence))}>
                            {formatPct(sig.confidence * 100)}
                          </div>
                          <div className="text-[10px] text-muted-foreground">confidence</div>
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
                    <div className={cn("text-lg font-bold", dailyStats.dailyPnL >= 0 ? 'text-emerald-500' : 'text-red-500')}>
                      {formatCurrency(dailyStats.dailyPnL)}
                    </div>
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
                <div className="text-center py-10 sm:py-16 text-muted-foreground text-xs sm:text-sm">
                  No trades yet
                </div>
              ) : (
                tradeHistory.slice(-20).reverse().map((trade, i) => (
                  <Card key={trade.id || i} className="bg-card/50">
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-1.5 sm:gap-2">
                            <span className="font-bold">{trade.digit}</span>
                            <Badge variant={trade.result === 'win' ? 'default' : 'destructive'} className="text-[10px]">
                              {trade.result}
                            </Badge>
                            <Badge variant="outline" className="text-[10px]">{trade.type}</Badge>
                          </div>
                          <div className="text-[10px] sm:text-xs text-muted-foreground mt-1 flex items-center gap-2">
                            <span>{trade.timestamp.toLocaleTimeString()}</span>
                            <span>{trade.symbol}</span>
                            <span>${trade.stake}</span>
                          </div>
                        </div>
                        <div className={cn("text-sm sm:text-base font-bold",
                          (trade.profit ?? 0) >= 0 ? 'text-emerald-500' : 'text-red-500'
                        )}>
                          {(trade.profit ?? 0) >= 0 ? '+' : ''}{formatCurrency(trade.profit ?? 0)}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-2 sm:space-y-3">
              <Card className="bg-card/50">
                <button
                  onClick={() => setSettingsExpanded(p => ({ ...p, trade: !p.trade }))}
                  className="flex items-center justify-between w-full p-3 sm:p-4"
                >
                  <CardTitle className="text-sm flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-emerald-500" /> Trade Settings
                  </CardTitle>
                  {settingsExpanded.trade ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                {settingsExpanded.trade && (
                  <CardContent className="px-3 pb-3 sm:px-4 sm:pb-4 pt-0 space-y-3">
                    <div className="space-y-1.5">
                      <label className="text-xs text-muted-foreground">Stake Amount ($)</label>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" className="h-8 w-8 p-0"
                          onClick={() => onUpdateConfig({ stake: Math.max(0.35, config.stake - 0.5) })}>
                          <Minus className="h-3 w-3" />
                        </Button>
                        <input
                          type="number"
                          value={config.stake}
                          onChange={e => onUpdateConfig({ stake: Math.max(0.35, parseFloat(e.target.value) || 0.35) })}
                          className="h-8 rounded border bg-background px-2 text-center text-sm w-20"
                          step="0.5"
                          min="0.35"
                        />
                        <Button variant="outline" size="sm" className="h-8 w-8 p-0"
                          onClick={() => onUpdateConfig({ stake: config.stake + 0.5 })}>
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs text-muted-foreground">Target Profit ($)</label>
                      <input
                        type="number"
                        value={config.targetProfit}
                        onChange={e => onUpdateConfig({ targetProfit: parseFloat(e.target.value) || 5 })}
                        className="h-8 w-full rounded border bg-background px-2 text-sm"
                        step="1"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs text-muted-foreground">Stop Loss ($)</label>
                      <input
                        type="number"
                        value={config.stopLoss}
                        onChange={e => onUpdateConfig({ stopLoss: parseFloat(e.target.value) || 20 })}
                        className="h-8 w-full rounded border bg-background px-2 text-sm"
                        step="1"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1.5">
                        <label className="text-xs text-muted-foreground">Duration (ticks)</label>
                        <input
                          type="number"
                          value={config.duration}
                          onChange={e => onUpdateConfig({ duration: parseInt(e.target.value) || 5 })}
                          className="h-8 w-full rounded border bg-background px-2 text-sm"
                          min="1"
                          max="100"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs text-muted-foreground">Max Daily Trades</label>
                        <input
                          type="number"
                          value={config.maxDailyTrades}
                          onChange={e => onUpdateConfig({ maxDailyTrades: parseInt(e.target.value) || 50 })}
                          className="h-8 w-full rounded border bg-background px-2 text-sm"
                          min="1"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs text-muted-foreground">Min Confidence</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="range"
                          min="0.3"
                          max="0.95"
                          step="0.05"
                          value={config.confidenceThreshold}
                          onChange={e => onUpdateConfig({ confidenceThreshold: parseFloat(e.target.value) })}
                          className="flex-1"
                        />
                        <span className="text-xs font-mono w-12 text-right">{formatPct(config.confidenceThreshold * 100)}</span>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs text-muted-foreground">Min Tick Interval (ms)</label>
                      <input
                        type="number"
                        value={config.minTickInterval}
                        onChange={e => onUpdateConfig({ minTickInterval: parseInt(e.target.value) || 500 })}
                        className="h-8 w-full rounded border bg-background px-2 text-sm"
                        min="200"
                        step="100"
                      />
                    </div>
                  </CardContent>
                )}
              </Card>

              <Card className="bg-card/50">
                <button
                  onClick={() => setSettingsExpanded(p => ({ ...p, strategy: !p.strategy }))}
                  className="flex items-center justify-between w-full p-3 sm:p-4"
                >
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Target className="h-4 w-4 text-purple-500" /> Strategies
                  </CardTitle>
                  {settingsExpanded.strategy ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                {settingsExpanded.strategy && (
                  <CardContent className="px-3 pb-3 sm:px-4 sm:pb-4 pt-0 space-y-2">
                    {STRATEGIES.map(s => (
                      <div key={s.id} className="flex items-center justify-between p-2 rounded border">
                        <div>
                          <div className="text-xs sm:text-sm font-medium">{s.label}</div>
                          <div className="text-[10px] sm:text-xs text-muted-foreground">{s.desc}</div>
                        </div>
                        <input
                          type="checkbox"
                          checked={(config.strategies ?? [s.id]).includes(s.id)}
                          onChange={() => {
                            const current = config.strategies ?? [];
                            const updated = current.includes(s.id)
                              ? current.filter(x => x !== s.id)
                              : [...current, s.id];
                            onUpdateConfig({ strategies: updated.length > 0 ? updated : [s.id] });
                          }}
                          className="h-4 w-4 accent-emerald-500"
                        />
                      </div>
                    ))}
                  </CardContent>
                )}
              </Card>

              <Card className="bg-card/50">
                <button
                  onClick={() => setSettingsExpanded(p => ({ ...p, risk: !p.risk }))}
                  className="flex items-center justify-between w-full p-3 sm:p-4"
                >
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Shield className="h-4 w-4 text-red-500" /> Risk Management
                  </CardTitle>
                  {settingsExpanded.risk ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                {settingsExpanded.risk && (
                  <CardContent className="px-3 pb-3 sm:px-4 sm:pb-4 pt-0 space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1.5">
                        <label className="text-xs text-muted-foreground">Max Consecutive Losses</label>
                        <input
                          type="number"
                          value={config.maxConsecutiveLosses}
                          onChange={e => onUpdateConfig({ maxConsecutiveLosses: parseInt(e.target.value) || 5 })}
                          className="h-8 w-full rounded border bg-background px-2 text-sm"
                          min="1"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs text-muted-foreground">Max Daily Loss ($)</label>
                        <input
                          type="number"
                          value={config.maxDailyLoss}
                          onChange={e => onUpdateConfig({ maxDailyLoss: parseFloat(e.target.value) || 50 })}
                          className="h-8 w-full rounded border bg-background px-2 text-sm"
                          step="5"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs text-muted-foreground">Max Daily Profit ($)</label>
                      <input
                        type="number"
                        value={config.maxDailyProfit}
                        onChange={e => onUpdateConfig({ maxDailyProfit: parseFloat(e.target.value) || 100 })}
                        className="h-8 w-full rounded border bg-background px-2 text-sm"
                        step="5"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs sm:text-sm">Auto Trade</span>
                      <input
                        type="checkbox"
                        checked={config.autoTrade}
                        onChange={() => onUpdateConfig({ autoTrade: !config.autoTrade })}
                        className="h-4 w-4 accent-emerald-500"
                      />
                    </div>
                  </CardContent>
                )}
              </Card>

              <Card className="bg-card/50">
                <button
                  onClick={() => setSettingsExpanded(p => ({ ...p, markets: !p.markets }))}
                  className="flex items-center justify-between w-full p-3 sm:p-4"
                >
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Activity className="h-4 w-4 text-cyan-500" /> Markets
                  </CardTitle>
                  {settingsExpanded.markets ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                {settingsExpanded.markets && (
                  <CardContent className="px-3 pb-3 sm:px-4 sm:pb-4 pt-0">
                    <div className="flex flex-wrap gap-1.5">
                      {ALL_MARKETS.map(m => (
                        <Badge
                          key={m.id}
                          variant={(config.markets ?? ALL_MARKETS.map(x => x.id)).includes(m.id) ? 'default' : 'outline'}
                          className="cursor-pointer text-[10px] sm:text-xs"
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
                    <p className="text-xs text-red-400 mb-3">
                      Bot has been stopped due to consecutive losses or daily loss limit.
                    </p>
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
