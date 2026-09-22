'use client';

import { useState, useRef, useEffect } from 'react';
import {
  X, Play, Pause, Settings, Activity, TrendingUp, Zap, BarChart3,
  AlertTriangle, Clock, Target, CheckCircle2,
  XCircle, History, Brain, DollarSign, StopCircle, RotateCcw, Eye,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import type {
  BotActivity, TradeSignal, BotConfig, MarketAnalysis, TradeRecord, DailyStats,
  RiskLevel,
} from './ai-bot-engine';

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
  onUpdateConfig: (config: Partial<BotConfig>) => void;
  onEmergencyStop: () => void;
  onResetEmergencyStop: () => void;
  balance?: number;
  tickCount?: number;
  currentSymbol?: string | null;
  isConnected?: boolean;
}

type Tab = 'dashboard' | 'signals' | 'history' | 'settings';

const fmt = (t: number) => new Date(t).toLocaleTimeString();
const fmtDate = (t: number) => new Date(t).toLocaleString();

function signalBadgeClass(type: string): string {
  switch (type) {
    case 'STRONG_BUY': return 'bg-emerald-500 text-white';
    case 'BUY': return 'bg-emerald-400 text-white';
    case 'WAIT': return 'bg-yellow-400 text-black';
    case 'SELL': return 'bg-red-400 text-white';
    case 'STRONG_SELL': return 'bg-red-500 text-white';
    default: return 'bg-gray-400 text-white';
  }
}

function riskBadgeClass(level: RiskLevel): string {
  switch (level) {
    case 'LOW': return 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30';
    case 'MEDIUM': return 'bg-yellow-500/15 text-yellow-600 border-yellow-500/30';
    case 'HIGH': return 'bg-orange-500/15 text-orange-600 border-orange-500/30';
    case 'EXTREME': return 'bg-red-500/15 text-red-600 border-red-500/30';
  }
}

function resultIcon(result: string) {
  switch (result) {
    case 'WIN': return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
    case 'LOSS': return <XCircle className="h-4 w-4 text-red-500" />;
    case 'PENDING': return <Clock className="h-4 w-4 text-yellow-500" />;
    case 'REJECTED': return <XCircle className="h-4 w-4 text-gray-400" />;
    default: return <XCircle className="h-4 w-4 text-gray-400" />;
  }
}

export function AIBotPanel({
  isOpen, onClose, isRunning, config, activities, signals, tradeHistory,
  dailyStats, lastAnalysis, emergencyStop, onStart, onStop, onUpdateConfig,
  onEmergencyStop, onResetEmergencyStop, balance = 0, tickCount = 0,
  currentSymbol, isConnected = false,
}: AIBotPanelProps) {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [selectedSignal, setSelectedSignal] = useState<TradeSignal | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activities]);

  if (!isOpen) return null;

  const winRate = dailyStats.totalTrades > 0
    ? ((dailyStats.wins / dailyStats.totalTrades) * 100).toFixed(1)
    : '0.0';

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full sm:max-w-3xl max-h-[100dvh] sm:max-h-[90vh] flex flex-col bg-background sm:rounded-2xl rounded-t-2xl border border-border shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-background shrink-0">
          <div className="flex items-center gap-3">
            <div className={cn(
              "flex h-9 w-9 items-center justify-center rounded-full shrink-0",
              isRunning ? "bg-emerald-500/20" : emergencyStop ? "bg-red-500/20" : "bg-muted"
            )}>
              {emergencyStop ? (
                <StopCircle className="h-5 w-5 text-red-500" />
              ) : (
                <Zap className={cn("h-5 w-5", isRunning ? "text-emerald-500" : "text-muted-foreground")} />
              )}
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold truncate">AI Trading Bot</h2>
              <p className="text-xs text-muted-foreground truncate">
                {emergencyStop ? 'Emergency Stop Active' : isRunning ? `Scanning ${currentSymbol || '...'}` : 'Ready'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {emergencyStop ? (
              <Button variant="outline" size="sm" onClick={onResetEmergencyStop} className="text-xs">
                <RotateCcw className="h-3 w-3 mr-1" /> Reset
              </Button>
            ) : (
              <Button
                variant="destructive"
                size="sm"
                onClick={onEmergencyStop}
                disabled={!isRunning}
                className="text-xs"
              >
                <StopCircle className="h-3 w-3 mr-1" /> Emergency
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Status Bar */}
        <div className="flex items-center gap-3 px-4 py-2 border-b bg-muted/30 text-xs shrink-0 overflow-x-auto">
          <span className="flex items-center gap-1 shrink-0">
            <span className={cn("h-2 w-2 rounded-full", isConnected ? "bg-emerald-500" : "bg-red-500")} />
            {isConnected ? 'Connected' : 'Offline'}
          </span>
          <Separator orientation="vertical" className="h-3" />
          <span className="shrink-0">Ticks: {tickCount}</span>
          <Separator orientation="vertical" className="h-3" />
          <span className="shrink-0">Balance: <b>${balance.toFixed(2)}</b></span>
          <Separator orientation="vertical" className="h-3" />
          <span className={cn("shrink-0 font-semibold", dailyStats.netPnl >= 0 ? "text-emerald-500" : "text-red-500")}>
            PnL: ${dailyStats.netPnl.toFixed(2)}
          </span>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-4 pt-2 border-b overflow-x-auto shrink-0">
          {([
            { key: 'dashboard' as Tab, label: 'Dashboard', icon: BarChart3 },
            { key: 'signals' as Tab, label: `Signals (${signals.length})`, icon: Zap },
            { key: 'history' as Tab, label: `History (${tradeHistory.length})`, icon: History },
            { key: 'settings' as Tab, label: 'Settings', icon: Settings },
          ]).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => { setTab(key); setSelectedSignal(null); }}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-t-lg transition-colors whitespace-nowrap",
                tab === key
                  ? "bg-background text-foreground border border-b-0 border-border"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-3.5 w-3.5" /> {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {/* ── DASHBOARD ── */}
          {tab === 'dashboard' && (
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <StatCard label="Trades Today" value={dailyStats.totalTrades} icon={<Target className="h-4 w-4 text-muted-foreground" />} />
                <StatCard label="Win Rate" value={`${winRate}%`} icon={<TrendingUp className="h-4 w-4 text-muted-foreground" />} />
                <StatCard label="Wins / Losses" value={`${dailyStats.wins}/${dailyStats.losses}`} icon={<Activity className="h-4 w-4 text-muted-foreground" />} />
                <StatCard label="Net PnL" value={`$${dailyStats.netPnl.toFixed(2)}`}
                  icon={<DollarSign className="h-4 w-4 text-muted-foreground" />}
                  valueClass={dailyStats.netPnl >= 0 ? 'text-emerald-500' : 'text-red-500'} />
              </div>

              {emergencyStop && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-600 text-sm">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>Emergency stop is active. All auto-trading halted.</span>
                </div>
              )}

              <div className="flex gap-2">
                {isRunning ? (
                  <Button variant="destructive" onClick={onStop} className="flex-1">
                    <Pause className="h-4 w-4 mr-2" /> Stop Bot
                  </Button>
                ) : (
                  <Button onClick={onStart} className="flex-1 bg-emerald-500 hover:bg-emerald-600" disabled={emergencyStop}>
                    <Play className="h-4 w-4 mr-2" /> Start Bot
                  </Button>
                )}
              </div>

              {/* Latest Signal Detail */}
              {signals.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Latest Signal</h3>
                  <SignalCard signal={signals[0]} onSelect={() => { setSelectedSignal(signals[0]); setTab('signals'); }} />
                </div>
              )}

              {/* Recent Activity */}
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Recent Activity</h3>
                <div className="space-y-1.5">
                  {activities.slice(0, 8).map(a => (
                    <ActivityRow key={a.id} activity={a} />
                  ))}
                  {activities.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-4">No activity yet.</p>
                  )}
                </div>
              </div>
              <div ref={bottomRef} />
            </div>
          )}

          {/* ── SIGNALS ── */}
          {tab === 'signals' && (
            <div className="p-4 space-y-3">
              {selectedSignal ? (
                <div className="space-y-3">
                  <Button variant="ghost" size="sm" onClick={() => setSelectedSignal(null)} className="text-xs">
                    ← Back to signals
                  </Button>
                  <SignalDetail signal={selectedSignal} />
                </div>
              ) : signals.length === 0 ? (
                <EmptyState message="No signals yet. Start the bot to begin scanning markets." />
              ) : (
                signals.map(s => (
                  <SignalCard key={s.id} signal={s} onSelect={() => setSelectedSignal(s)} />
                ))
              )}
            </div>
          )}

          {/* ── HISTORY ── */}
          {tab === 'history' && (
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 rounded-lg bg-muted/50">
                  <p className="text-lg font-bold">{dailyStats.totalTrades}</p>
                  <p className="text-[10px] text-muted-foreground">Total</p>
                </div>
                <div className="p-2 rounded-lg bg-emerald-500/10">
                  <p className="text-lg font-bold text-emerald-500">{dailyStats.wins}</p>
                  <p className="text-[10px] text-muted-foreground">Wins</p>
                </div>
                <div className="p-2 rounded-lg bg-red-500/10">
                  <p className="text-lg font-bold text-red-500">{dailyStats.losses}</p>
                  <p className="text-[10px] text-muted-foreground">Losses</p>
                </div>
              </div>
              {tradeHistory.length === 0 ? (
                <EmptyState message="No trades recorded yet." />
              ) : (
                <div className="space-y-2">
                  {tradeHistory.map(t => (
                    <div key={t.id} className="flex items-center gap-3 p-3 rounded-lg border border-border text-sm">
                      {resultIcon(t.result)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">{t.symbol}</span>
                          <Badge variant="outline" className="text-[10px]">{t.contractMode}</Badge>
                          <Badge variant="outline" className={cn("text-[10px]", riskBadgeClass(t.riskLevel))}>{t.riskLevel}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{t.reason}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-semibold">${t.stake.toFixed(2)}</p>
                        <p className={cn("text-xs font-medium", t.profit >= 0 ? "text-emerald-500" : "text-red-500")}>
                          {t.profit >= 0 ? '+' : ''}{t.profit.toFixed(2)}
                        </p>
                        <p className="text-[10px] text-muted-foreground">{fmtDate(t.timestamp)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── SETTINGS ── */}
          {tab === 'settings' && (
            <div className="p-4 space-y-4">
              <SettingsSection title="Trading">
                <SettingRow label="Stake Amount ($)" >
                  <Input type="number" value={config.stake} min={1} max={1000}
                    onChange={e => onUpdateConfig({ stake: Number(e.target.value) })} className="w-24 h-8 text-xs" />
                </SettingRow>
                <SettingRow label="Duration (ticks)">
                  <Input type="number" value={config.duration} min={1} max={10}
                    onChange={e => onUpdateConfig({ duration: Number(e.target.value) })} className="w-24 h-8 text-xs" />
                </SettingRow>
                <SettingRow label="Auto-Trade">
                  <Switch checked={config.autoTrade} onCheckedChange={v => onUpdateConfig({ autoTrade: v })} />
                </SettingRow>
              </SettingsSection>

              <SettingsSection title="Risk Management">
                <SettingRow label="Target Profit ($)">
                  <Input type="number" value={config.targetProfit} min={0}
                    onChange={e => onUpdateConfig({ targetProfit: Number(e.target.value) })} className="w-24 h-8 text-xs" />
                </SettingRow>
                <SettingRow label="Stop-Loss ($)">
                  <Input type="number" value={config.stopLoss} min={1}
                    onChange={e => onUpdateConfig({ stopLoss: Number(e.target.value) })} className="w-24 h-8 text-xs" />
                </SettingRow>
                <SettingRow label="Max Trades/Day">
                  <Input type="number" value={config.maxTrades} min={1}
                    onChange={e => onUpdateConfig({ maxTrades: Number(e.target.value) })} className="w-24 h-8 text-xs" />
                </SettingRow>
                <SettingRow label="Max Consecutive Losses">
                  <Input type="number" value={config.maxConsecutiveLosses} min={1}
                    onChange={e => onUpdateConfig({ maxConsecutiveLosses: Number(e.target.value) })} className="w-24 h-8 text-xs" />
                </SettingRow>
                <SettingRow label="Max Daily Loss ($)">
                  <Input type="number" value={config.maxDailyLoss} min={1}
                    onChange={e => onUpdateConfig({ maxDailyLoss: Number(e.target.value) })} className="w-24 h-8 text-xs" />
                </SettingRow>
                <SettingRow label="Max Daily Profit ($)">
                  <Input type="number" value={config.maxDailyProfit} min={0}
                    onChange={e => onUpdateConfig({ maxDailyProfit: Number(e.target.value) })} className="w-24 h-8 text-xs" />
                </SettingRow>
              </SettingsSection>

              <SettingsSection title="Signal Generation">
                <SettingRow label="Min Confidence (%)">
                  <Input type="number" value={config.minConfidence} min={50} max={95}
                    onChange={e => onUpdateConfig({ minConfidence: Number(e.target.value) })} className="w-24 h-8 text-xs" />
                </SettingRow>
                <SettingRow label="Min Interval Between Trades (ms)">
                  <Input type="number" value={config.minTickInterval} min={500} step={500}
                    onChange={e => onUpdateConfig({ minTickInterval: Number(e.target.value) })} className="w-24 h-8 text-xs" />
                </SettingRow>
                <SettingRow label="Scan Interval (ms)">
                  <Input type="number" value={config.scanInterval} min={1000} step={1000}
                    onChange={e => onUpdateConfig({ scanInterval: Number(e.target.value) })} className="w-24 h-8 text-xs" />
                </SettingRow>
              </SettingsSection>

              <SettingsSection title="Over/Under Strategy">
                <SettingRow label="Enable Over/Under">
                  <Switch checked={config.overUnderStrategy} onCheckedChange={v => onUpdateConfig({ overUnderStrategy: v })} />
                </SettingRow>
                <SettingRow label="Over Threshold">
                  <Input type="number" value={config.overThreshold} min={0} max={9}
                    onChange={e => onUpdateConfig({ overThreshold: Number(e.target.value) })} className="w-24 h-8 text-xs" />
                </SettingRow>
                <SettingRow label="Under Threshold">
                  <Input type="number" value={config.underThreshold} min={1} max={9}
                    onChange={e => onUpdateConfig({ underThreshold: Number(e.target.value) })} className="w-24 h-8 text-xs" />
                </SettingRow>
              </SettingsSection>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Sub-components ── */

function StatCard({ label, value, icon, valueClass }: { label: string; value: React.ReactNode; icon: React.ReactNode; valueClass?: string }) {
  return (
    <div className="p-2.5 rounded-lg border border-border bg-card">
      <div className="flex items-center gap-1.5 mb-1">{icon}<span className="text-[10px] text-muted-foreground">{label}</span></div>
      <p className={cn("text-lg font-bold", valueClass)}>{value}</p>
    </div>
  );
}

function ActivityRow({ activity }: { activity: BotActivity }) {
  const iconMap: Record<string, React.ReactNode> = {
    SCAN: <BarChart3 className="h-3.5 w-3.5" />,
    ANALYSIS: <Brain className="h-3.5 w-3.5" />,
    SIGNAL: <Zap className="h-3.5 w-3.5 text-emerald-500" />,
    TRADE: <TrendingUp className="h-3.5 w-3.5 text-blue-500" />,
    RESULT: <Activity className="h-3.5 w-3.5" />,
    ERROR: <XCircle className="h-3.5 w-3.5 text-red-500" />,
    WARNING: <AlertTriangle className="h-3.5 w-3.5 text-orange-500" />,
    INFO: <Eye className="h-3.5 w-3.5 text-muted-foreground" />,
  };
  return (
    <div className={cn(
      "flex items-start gap-2 p-2 rounded-md text-xs",
      activity.type === 'ERROR' && "bg-red-500/5 border border-red-500/20",
      activity.type === 'WARNING' && "bg-orange-500/5 border border-orange-500/20",
      activity.type === 'SIGNAL' && "bg-emerald-500/5 border border-emerald-500/20",
      activity.type === 'TRADE' && "bg-blue-500/5 border border-blue-500/20",
    )}>
      <span className="mt-0.5 shrink-0">{iconMap[activity.type] ?? <Eye className="h-3.5 w-3.5" />}</span>
      <div className="flex-1 min-w-0">
        <p className="leading-snug">{activity.message}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">{fmt(activity.timestamp)}</p>
      </div>
    </div>
  );
}

function SignalCard({ signal, onSelect }: { signal: TradeSignal; onSelect: () => void }) {
  return (
    <button onClick={onSelect} className="w-full text-left p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge className={cn("text-[10px]", signalBadgeClass(signal.signalType))}>{signal.signalType}</Badge>
          <span className="font-medium text-sm">{signal.symbol}</span>
          <Badge variant="outline" className="text-[10px]">{signal.contractMode}</Badge>
        </div>
        <div className="text-right">
          <p className="text-sm font-bold">{signal.confidence.toFixed(1)}%</p>
          <Badge variant="outline" className={cn("text-[10px]", riskBadgeClass(signal.riskLevel))}>{signal.riskLevel}</Badge>
        </div>
      </div>
      <p className="text-xs text-muted-foreground line-clamp-1">{signal.reasonForEntry}</p>
    </button>
  );
}

function SignalDetail({ signal }: { signal: TradeSignal }) {
  return (
    <div className="space-y-3">
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">{signal.symbol} — {signal.contractMode}</CardTitle>
            <Badge className={signalBadgeClass(signal.signalType)}>{signal.signalType}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-2">
            <InfoRow label="Confidence" value={`${signal.confidence.toFixed(1)}%`} />
            <InfoRow label="Risk Level" value={signal.riskLevel} />
            <InfoRow label="Current Tick" value={signal.currentTick.toFixed(2)} />
            <InfoRow label="Direction" value={signal.direction} />
            <InfoRow label="Stake" value={`$${signal.recommendedStake.toFixed(2)}`} />
            <InfoRow label="Time" value={fmtDate(signal.timestamp)} />
          </div>

          {signal.predictedDigit !== undefined && (
            <div className="p-2 rounded bg-primary/10 text-center">
              <span className="text-xs text-muted-foreground">Predicted Digit: </span>
              <span className="text-lg font-bold text-primary">{signal.predictedDigit}</span>
            </div>
          )}

          {signal.recentTicks.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Recent Ticks</p>
              <div className="flex gap-1 flex-wrap">
                {signal.recentTicks.map((t, i) => (
                  <span key={i} className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-mono">{t.toFixed(2)}</span>
                ))}
              </div>
            </div>
          )}

          {signal.indicators.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Indicators</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                {signal.indicators.map((ind, i) => (
                  <div key={i} className="flex items-center justify-between p-1.5 rounded bg-muted/50 text-xs">
                    <span className="text-muted-foreground">{ind.name}</span>
                    <span className={cn("font-medium", ind.bullish ? "text-emerald-500" : "text-muted-foreground")}>{ind.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Reasoning</p>
            <ul className="space-y-0.5">
              {signal.reasoning.map((r, i) => (
                <li key={i} className="text-xs text-muted-foreground">• {r}</li>
              ))}
            </ul>
          </div>

          <div className="p-2 rounded bg-muted/30 border border-border">
            <p className="text-xs font-medium mb-0.5">Entry Reason</p>
            <p className="text-xs text-muted-foreground">{signal.reasonForEntry}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center p-1.5 rounded bg-muted/30">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs font-medium">{value}</span>
    </div>
  );
}

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{title}</h3>
      <div className="space-y-2.5 p-3 rounded-lg border border-border bg-card">
        {children}
      </div>
    </div>
  );
}

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <Label className="text-xs text-muted-foreground whitespace-nowrap">{label}</Label>
      {children}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center py-12 text-muted-foreground">
      <Zap className="h-8 w-8 mx-auto mb-2 opacity-30" />
      <p className="text-sm">{message}</p>
    </div>
  );
}
