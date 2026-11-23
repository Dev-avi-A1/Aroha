import React, { useEffect, useState } from 'react';
import { Download, Smartphone, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsInstalled(isStandalone);

    const ua = window.navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(ua));
    setIsAndroid(/android/.test(ua));

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setDeferredPrompt(null);
      return true;
    }
    return false;
  };

  return {
    isInstallable: !!deferredPrompt,
    isInstalled,
    isIOS,
    isAndroid,
    install,
  };
}

export function PWAInstallButton({
  variant = 'outline',
  size = 'sm',
  className = '',
  alwaysShowGuide = false,
}: {
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'sm' | 'default';
  className?: string;
  alwaysShowGuide?: boolean;
}) {
  const { isInstallable, isInstalled, isIOS, isAndroid, install } = usePWAInstall();
  const [guideOpen, setGuideOpen] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <Button
        type="button"
        variant={variant}
        size={size}
        onClick={() => void install()}
        className={className}
      >
        <Download className="h-3.5 w-3.5" />
        Install Android App
      </Button>
    );
  }

  if (!isIOS && !isAndroid && !alwaysShowGuide) {
    return null;
  }

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        onClick={() => setGuideOpen(true)}
        className={className}
      >
        <Smartphone className="h-3.5 w-3.5" />
        {isIOS ? 'Install on iOS' : 'Run as Android App'}
      </Button>

      <Dialog open={guideOpen} onOpenChange={setGuideOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isIOS ? 'Install AROHA on iPhone / iPad' : 'Install AROHA on Android'}
            </DialogTitle>
            <DialogDescription>
              Run AROHA full-screen from your home screen with offline caching and push alerts.
            </DialogDescription>
          </DialogHeader>
          {isIOS ? (
            <ol className="space-y-2 text-sm text-muted-foreground list-decimal pl-5">
              <li>
                Tap the <strong className="text-foreground">Share</strong> button in Safari.
              </li>
              <li>
                Scroll down and tap <strong className="text-foreground">Add to Home Screen</strong>.
              </li>
              <li>
                Tap <strong className="text-foreground">Add</strong> to launch AROHA standalone.
              </li>
            </ol>
          ) : (
            <ol className="space-y-2 text-sm text-muted-foreground list-decimal pl-5">
              <li>
                Open this app URL in <strong className="text-foreground">Chrome on Android</strong>.
              </li>
              <li>
                Tap the <strong className="text-foreground">⋮ menu</strong> in the top-right corner.
              </li>
              <li>
                Tap <strong className="text-foreground">Install app</strong> or{' '}
                <strong className="text-foreground">Add to Home screen</strong> to install it as a standalone Android app.
              </li>
            </ol>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}

export function OfflineIndicator() {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-20 lg:bottom-4 left-4 z-50 flex items-center gap-2 rounded-xl border border-warning/40 bg-surface px-3.5 py-2 text-xs font-medium text-warning shadow-lg">
      <WifiOff className="h-3.5 w-3.5 animate-pulse" />
      <span>Offline Mode — Cached AROHA data active</span>
    </div>
  );
}
