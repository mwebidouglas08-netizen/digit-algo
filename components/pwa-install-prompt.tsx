'use client';

import { useEffect, useState } from 'react';
import { Download, X, Share } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function PwaInstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    setIsIOS(/iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as unknown as { MSStream?: unknown }).MSStream);
    setIsStandalone(window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true);
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    const onAppInstalled = () => setDeferred(null);
    window.addEventListener('appinstalled', onAppInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, []);

  if (isStandalone || dismissed) return null;

  // Android/Desktop Chrome — show install button when prompt available
  if (deferred) {
    return (
      <Card className="fixed bottom-4 left-3 right-3 z-50 border-emerald-500/30 bg-background shadow-xl sm:left-auto sm:right-4 sm:max-w-sm">
        <CardContent className="flex items-center gap-3 p-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500 text-white">
            <Download className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold">Install Digits Algo</div>
            <div className="text-xs text-muted-foreground">Add to home screen for quick access</div>
          </div>
          <Button
            size="sm"
            className="h-8 bg-emerald-600 hover:bg-emerald-700 shrink-0"
            onClick={async () => {
              await deferred.prompt();
              const choice = await deferred.userChoice;
              if (choice.outcome === 'accepted') setDeferred(null);
            }}
          >
            Install
          </Button>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 shrink-0" onClick={() => setDismissed(true)}>
            <X className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    );
  }

  // iOS — show manual Add to Home Screen hint (no prompt event)
  if (isIOS) {
    // Only show once per session, dismissible
    return (
      <Card className="fixed bottom-4 left-3 right-3 z-50 border-blue-500/30 bg-background shadow-xl sm:left-auto sm:right-4 sm:max-w-sm">
        <CardContent className="flex items-start gap-3 p-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-500 text-white">
            <Share className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold">Install on iPhone</div>
            <div className="text-xs text-muted-foreground">Tap <Share className="inline h-3 w-3" /> Share → <b>Add to Home Screen</b></div>
          </div>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 shrink-0" onClick={() => setDismissed(true)}>
            <X className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    );
  }

  return null;
}
