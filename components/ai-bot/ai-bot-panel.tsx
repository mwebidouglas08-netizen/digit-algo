'use client';

import { useState, useRef, useEffect } from 'react';
import { X, Play, Pause, Settings, Activity, TrendingUp, Zap, BarChart3, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { BotActivity, TradeSignal, BotConfig, MarketAnalysis } from './ai-bot-engine';
import type { DigitStats } from '@/lib/types';

interface AIBotPanelProps {
  isOpen: boolean;
  onClose: () => void;
  isRunning: boolean;
  config: BotConfig;
  activities: BotActivity[];
  signals: TradeSignal[];
  lastAnalysis: MarketAnalysis | null;
  onStart: () => void;
  onStop: () => void;
  onUpdateConfig: (config: Partial<BotConfig>) => void;
  balance?: number;
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString();
}

function getSignalColor(type: string): string {
  switch (type) {
    case 'STRONG_BUY': return 'bg-emerald-500';
    case 'BUY': return 'bg-emerald-400';
    case 'NEUTRAL': return 'bg-yellow-400';
    case 'SELL': return 'bg-red-400';
    case 'STRONG_SELL': return 'bg-red-500';
    default: return 'bg-gray-400';
  }
}

function getActivityIcon(type: string) {
  switch (type) {
    case 'SCAN': return <BarChart3 className="h-4 w-4" />;
    case 'ANALYSIS': return <Activity className="h-4 w-4" />;
    case 'SIGNAL': return <Zap className="h-4 w-4" />;
    case 'TRADE': return <TrendingUp className="h-4 w-4" />;
    case 'RESULT': return <Activity className="h-4 w-4" />;
    case 'ERROR': return <X className="h-4 w-4 text-red-500" />;
    default: return <Activity className="h-4 w-4" />;
  }
}

export function AIBotPanel({
  isOpen,
  onClose,
  isRunning,
  config,
  activities,
  signals,
  lastAnalysis,
  onStart,
  onStop,
  onUpdateConfig,
  balance = 0,
}: AIBotPanelProps) {
  const [showSettings, setShowSettings] = useState(false);
  const [activeTab, setActiveTab] = useState<'activity' | 'signals' | 'analysis'>('activity');
  const activitiesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activitiesEndRef.current) {
      activitiesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activities]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <Card className="w-full max-w-2xl max-h-[90vh] flex flex-col m-4 bg-background border-border shadow-2xl">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 border-b">
          <div className="flex items-center gap-3">
            <div className={cn(
              "flex h-10 w-10 items-center justify-center rounded-full",
              isRunning ? "bg-emerald-500/20" : "bg-muted"
            )}>
              <Zap className={cn("h-5 w-5", isRunning ? "text-emerald-500" : "text-muted-foreground")} />
            </div>
            <div>
              <CardTitle className="text-lg">AI Trading Bot</CardTitle>
              <p className="text-sm text-muted-foreground">
                {isRunning ? 'Scanning markets...' : 'Ready to scan'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setShowSettings(!showSettings)}
            >
              <Settings className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="flex-1 overflow-hidden p-4">
          {showSettings ? (
            <div className="space-y-4">
              <h3 className="text-sm font-medium">Bot Settings</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="minConfidence">Min Confidence (%)</Label>
                  <Input
                    id="minConfidence"
                    type="number"
                    value={config.minConfidence}
                    onChange={(e) => onUpdateConfig({ minConfidence: Number(e.target.value) })}
                    min={50}
                    max={95}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="maxStake">Max Stake ($)</Label>
                  <Input
                    id="maxStake"
                    type="number"
                    value={config.maxStake}
                    onChange={(e) => onUpdateConfig({ maxStake: Number(e.target.value) })}
                    min={1}
                    max={1000}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="stakePercent">Stake % of Balance</Label>
                  <Input
                    id="stakePercent"
                    type="number"
                    value={config.stakePercentage}
                    onChange={(e) => onUpdateConfig({ stakePercentage: Number(e.target.value) })}
                    min={0.5}
                    max={10}
                    step={0.5}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="scanInterval">Scan Interval (ms)</Label>
                  <Input
                    id="scanInterval"
                    type="number"
                    value={config.scanInterval}
                    onChange={(e) => onUpdateConfig({ scanInterval: Number(e.target.value) })}
                    min={1000}
                    max={30000}
                    step={1000}
                  />
                </div>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Auto-Trade</Label>
                  <p className="text-xs text-muted-foreground">
                    Automatically execute trades when confidence is high
                  </p>
                </div>
                <Switch
                  checked={config.autoTrade}
                  onCheckedChange={(checked) => onUpdateConfig({ autoTrade: checked })}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex gap-2 mb-4">
                <Button
                  variant={activeTab === 'activity' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setActiveTab('activity')}
                >
                  Activity ({activities.length})
                </Button>
                <Button
                  variant={activeTab === 'signals' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setActiveTab('signals')}
                >
                  Signals ({signals.length})
                </Button>
                <Button
                  variant={activeTab === 'analysis' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setActiveTab('analysis')}
                >
                  Analysis
                </Button>
              </div>

              {activeTab === 'activity' && (
                <ScrollArea className="h-[400px] pr-4">
                  <div className="space-y-2">
                    {activities.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        No activity yet. Start the bot to begin scanning.
                      </div>
                    ) : (
                      activities.map((activity) => (
                        <div
                          key={activity.id}
                          className={cn(
                            "flex items-start gap-3 p-3 rounded-lg border",
                            activity.type === 'ERROR' && "border-red-500/50 bg-red-500/5",
                            activity.type === 'SIGNAL' && "border-emerald-500/50 bg-emerald-500/5",
                            activity.type === 'TRADE' && "border-blue-500/50 bg-blue-500/5"
                          )}
                        >
                          <div className="mt-0.5 text-muted-foreground">
                            {getActivityIcon(activity.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm">{activity.message}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {formatTime(activity.timestamp)}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                    <div ref={activitiesEndRef} />
                  </div>
                </ScrollArea>
              )}

              {activeTab === 'signals' && (
                <ScrollArea className="h-[400px] pr-4">
                  <div className="space-y-2">
                    {signals.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        No signals generated yet.
                      </div>
                    ) : (
                      signals.map((signal) => (
                        <div
                          key={signal.id}
                          className="p-3 rounded-lg border border-border"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className={getSignalColor(signal.signalType)}>
                                {signal.signalType}
                              </Badge>
                              <span className="font-medium">{signal.symbol}</span>
                            </div>
                            <span className="text-sm font-bold">
                              {signal.confidence.toFixed(1)}%
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground space-y-1">
                            <p>Contract: {signal.contractMode}</p>
                            {signal.predictedDigit !== undefined && (
                              <p>Predicted Digit: {signal.predictedDigit}</p>
                            )}
                            <p>Time: {formatTime(signal.timestamp)}</p>
                          </div>
                          {signal.reasoning.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-border">
                              <p className="text-xs font-medium mb-1">Reasoning:</p>
                              <ul className="text-xs text-muted-foreground space-y-0.5">
                                {signal.reasoning.map((reason, i) => (
                                  <li key={i}>• {reason}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              )}

              {activeTab === 'analysis' && (
                <ScrollArea className="h-[400px] pr-4">
                  {lastAnalysis ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 rounded-lg border border-border">
                          <p className="text-xs text-muted-foreground">Symbol</p>
                          <p className="text-lg font-bold">{lastAnalysis.symbol}</p>
                        </div>
                        <div className="p-3 rounded-lg border border-border">
                          <p className="text-xs text-muted-foreground">Last Digit</p>
                          <p className="text-lg font-bold">{lastAnalysis.lastDigit}</p>
                        </div>
                        <div className="p-3 rounded-lg border border-border">
                          <p className="text-xs text-muted-foreground">Volatility</p>
                          <p className="text-lg font-bold">{lastAnalysis.volatility.toFixed(2)}</p>
                        </div>
                        <div className="p-3 rounded-lg border border-border">
                          <p className="text-xs text-muted-foreground">Trend</p>
                          <p className="text-lg font-bold">{lastAnalysis.trend.direction}</p>
                        </div>
                      </div>

                      <div className="p-3 rounded-lg border border-border">
                        <p className="text-xs text-muted-foreground mb-2">Digit Distribution</p>
                        <div className="flex gap-1">
                          {lastAnalysis.digitStats.percentages.map((pct, digit) => (
                            <div
                              key={digit}
                              className="flex-1 flex flex-col items-center"
                            >
                              <div
                                className="w-full bg-primary/20 rounded-t"
                                style={{ height: `${Math.max(4, pct * 2)}px` }}
                              />
                              <span className="text-[10px] text-muted-foreground mt-1">{digit}</span>
                              <span className="text-[8px] text-muted-foreground">{pct.toFixed(0)}%</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {lastAnalysis.patterns.length > 0 && (
                        <div className="p-3 rounded-lg border border-border">
                          <p className="text-xs text-muted-foreground mb-2">Detected Patterns</p>
                          <div className="space-y-1">
                            {lastAnalysis.patterns.map((pattern, i) => (
                              <div key={i} className="text-xs">
                                <span className="font-medium">{pattern.type}:</span>{' '}
                                <span className="text-muted-foreground">{pattern.description}</span>
                                <span className="ml-2 text-emerald-500">
                                  ({pattern.confidence}% conf)
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="p-3 rounded-lg border border-border">
                        <p className="text-xs text-muted-foreground mb-2">Streak Analysis</p>
                        <p className="text-sm">
                          Current digit: <span className="font-bold">{lastAnalysis.streaks.currentDigit}</span>
                          {lastAnalysis.streaks.streakLength > 1 && (
                            <span className="ml-2 text-muted-foreground">
                              ({lastAnalysis.streaks.streakLength} streak)
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      No analysis data yet. Start the bot to analyze markets.
                    </div>
                  )}
                </ScrollArea>
              )}
            </div>
          )}
        </CardContent>

        <div className="p-4 border-t">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Balance: <span className="font-bold text-foreground">${balance.toFixed(2)}</span>
            </div>
            <div className="flex gap-2">
              {isRunning ? (
                <Button variant="destructive" onClick={onStop}>
                  <Pause className="h-4 w-4 mr-2" />
                  Stop Bot
                </Button>
              ) : (
                <Button onClick={onStart}>
                  <Play className="h-4 w-4 mr-2" />
                  Start Bot
                </Button>
              )}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
