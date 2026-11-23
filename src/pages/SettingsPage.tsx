import React from 'react';
import { Bell, RotateCcw, Shield, Smartphone, Volume2 } from 'lucide-react';
import { useWorkspace } from '@/context/WorkspaceContext';
import { playTacticalChime } from '@/lib/audio';
import { AppShell } from '@/components/aroha/app-shell';
import { PageHeading, SectionHeader } from '@/components/aroha/primitives';
import { PWAInstallButton, usePWAInstall } from '@/components/aroha/pwa-controls';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';

export function SettingsPage() {
  const { workspace, updateProfile, resetWorkspace } = useWorkspace();
  const { isInstalled } = usePWAInstall();

  if (!workspace) {
    return (
      <AppShell title="Settings">
        <div className="card-surface p-6 text-sm text-muted-foreground">Loading preferences...</div>
      </AppShell>
    );
  }

  const u = workspace.user;

  return (
    <AppShell title="System Settings">
      <PageHeading
        title="System Settings"
        subtitle="Audio cues, haptics, Deep Work suppression, and workspace lifecycle"
      />

      <div className="card-surface p-6 space-y-6 max-w-2xl">
        <SectionHeader title="Tactical Behavior" subtitle="Real-time preferences synced to Cloud SQL" />

        <div className="space-y-5 divide-y divide-border/60">
          <div className="flex items-center justify-between gap-4 pt-1">
            <div className="flex items-start gap-3">
              <Shield className="h-4 w-4 text-primary mt-1" />
              <div>
                <p className="text-sm font-medium">Deep Focus Mode</p>
                <p className="text-xs text-muted-foreground">Highlight active mission lock across navigation</p>
              </div>
            </div>
            <Switch
              checked={u.focusModeEnabled}
              onCheckedChange={(checked) => updateProfile({ focusModeEnabled: checked })}
            />
          </div>

          <div className="flex items-center justify-between gap-4 pt-5">
            <div className="flex items-start gap-3">
              <Bell className="h-4 w-4 text-secondary mt-1" />
              <div>
                <p className="text-sm font-medium">Protocol Notifications</p>
                <p className="text-xs text-muted-foreground">Enable lead-time alerts and custom reminders</p>
              </div>
            </div>
            <Switch
              checked={u.notificationsEnabled}
              onCheckedChange={(checked) => updateProfile({ notificationsEnabled: checked })}
            />
          </div>

          <div className="space-y-4 pt-5">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <Volume2 className="h-4 w-4 text-success mt-1" />
                <div>
                  <p className="text-sm font-medium">Synthesized Audio Chimes</p>
                  <p className="text-xs text-muted-foreground">Audio feedback on timer, blocks, and check-ins</p>
                </div>
              </div>
              <Switch
                checked={u.soundEnabled}
                onCheckedChange={(checked) => updateProfile({ soundEnabled: checked })}
              />
            </div>

            <div className="pl-7 space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Audio Volume</span>
                <span className="num">{u.soundVolume}%</span>
              </div>
              <Slider
                value={[u.soundVolume]}
                min={0}
                max={100}
                step={5}
                onValueCommit={([val]) => {
                  updateProfile({ soundVolume: val });
                  playTacticalChime('start', u.soundEnabled, val);
                }}
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 pt-5">
            <div className="flex items-start gap-3">
              <Smartphone className="h-4 w-4 text-warning mt-1" />
              <div>
                <p className="text-sm font-medium">Haptic Feedback</p>
                <p className="text-xs text-muted-foreground">Tactile vibration on mobile check-ins</p>
              </div>
            </div>
            <Switch
              checked={u.hapticsEnabled}
              onCheckedChange={(checked) => updateProfile({ hapticsEnabled: checked })}
            />
          </div>
        </div>
      </div>

      {/* Android & Mobile Standalone App */}
      <div className="card-surface p-6 max-w-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-base font-semibold">Android &amp; Mobile App</h3>
          <p className="text-xs text-muted-foreground">
            {isInstalled
              ? 'Running in standalone mobile app mode with offline cache enabled.'
              : 'Install AROHA onto your Android home screen for full-screen standalone execution and offline caching.'}
          </p>
        </div>
        <div className="shrink-0">
          {isInstalled ? (
            <span className="text-xs font-medium text-success">Standalone Active</span>
          ) : (
            <PWAInstallButton variant="default" alwaysShowGuide />
          )}
        </div>
      </div>

      {/* Data Reset */}
      <div className="card-surface p-6 max-w-2xl space-y-3 border-destructive/40">
        <SectionHeader
          title="Workspace Reset"
          subtitle="Clear all personal logs and restore the clean Monk Mode starter baseline"
        />
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm">
              <RotateCcw className="h-3.5 w-3.5" /> Reset to Monk Mode Baseline
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reset all AROHA workspace records?</AlertDialogTitle>
              <AlertDialogDescription>
                This permanently deletes your schedule history, habit check-ins, focus sessions, journals, goals, and coach logs, then re-initializes the default Monk Mode starter kit.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => resetWorkspace()}>Confirm Reset</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppShell>
  );
}
