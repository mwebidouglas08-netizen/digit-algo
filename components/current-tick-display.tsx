'use client';

import { Localize } from '@deriv-com/translations';
import type { Tick } from '../lib/types';
import type { ActiveSymbol } from '../lib/types';

interface CurrentTickDisplayProps {
  tick: Tick | null;
  lastDigit: number | null;
  activeSymbol: ActiveSymbol | null;
  pipSize: number;
  digitStats?: import('../lib/types').DigitStats | null;
}

export function CurrentTickDisplay({
  tick,
  lastDigit,
  activeSymbol,
  pipSize,
  digitStats,
}: CurrentTickDisplayProps) {
  if (!tick || !activeSymbol) {
    return (
      <div className="text-center py-3 sm:py-6">
        <div className="text-xl sm:text-2xl font-mono text-muted-foreground">---</div>
      </div>
    );
  }

  const priceStr = tick.quote.toFixed(pipSize);
  const priceWithoutLast = priceStr.slice(0, -1);
  const lastDigitStr = priceStr.slice(-1);
  const pct = digitStats && lastDigit !== null && digitStats.totalTicks > 0 ? digitStats.percentages[lastDigit] : null;
  const confidence = pct !== null ? Math.min(95, Math.max(0, 50 + (pct - 10) * 3 + (pct > 12 ? 10 : 0))) : null;

  return (
    <div className="text-center py-2 sm:py-4">
      <div className="flex items-center justify-center gap-1.5 text-[10px] leading-none mb-1">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
        <span className="font-medium tracking-widest text-emerald-600">LIVE TICK</span>
        <span className="text-muted-foreground">• {tick.epoch ? new Date(tick.epoch * 1000).toLocaleTimeString() : ''}</span>
      </div>
      <div className="text-xl sm:text-3xl font-mono font-bold tracking-wide">
        <span className="text-foreground">{priceWithoutLast}</span>
        <span className="text-primary text-2xl sm:text-4xl">{lastDigitStr}</span>
      </div>
      <div className="mt-1 sm:mt-2 inline-flex items-center gap-1.5 text-[11px] sm:text-xs text-muted-foreground flex-wrap justify-center">
        <span>
          <Localize i18n_default_text="Last Digit:" />
        </span>
        <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
          {lastDigit}
        </span>
        {pct !== null && (
          <>
            <span className="hidden sm:inline">•</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 font-mono text-[11px]">
              {pct.toFixed(1)}% <span className="text-muted-foreground">freq</span>
            </span>
            {confidence !== null && (
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${confidence >= 75 ? 'bg-emerald-500 text-white' : confidence >= 60 ? 'bg-amber-500 text-white' : 'bg-muted text-muted-foreground'}`}>
                {confidence.toFixed(0)}% conf
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
}
