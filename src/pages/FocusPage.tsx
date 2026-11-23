import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Pause, Play, RotateCcw, Shield, Timer } from 'lucide-react';
import { useWorkspace } from '@/context/WorkspaceContext';
import { playTacticalChime, triggerHaptic } from '@/lib/audio';
import { AppShell } from '@/components/aroha/app-shell';
import { PageHeading, SectionHeader, StatTile } from '@/components/aroha/primitives';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type TimerPreset = 'focus25' | 'short5' | 'long15' | 'custom';

export function FocusPage() {
  const { workspace, updateProfile, logFocusSession } = useWorkspace();
  const [mode, setMode] = useState<'pomodoro' | 'stopwatch'>('pomodoro');
  const [preset, setPreset] = useState<TimerPreset>('focus25');
  const [customMinutes, setCustomMinutes] = useState('50');
  const [label, setLabel] = useState('Deep Work Sprint');

  const getInitialSeconds = (p: TimerPreset, custom: string) => {
    if (p === 'focus25') return 25 * 60;
    if (p === 'short5') return 5 * 60;
    if (p === 'long15') return 15 * 60;
    const mins = Math.max(1, Math.min(180, Number.parseInt(custom, 10) || 50));
    return mins * 60;
  };

  const [secondsLeft, setSecondsLeft] = useState(() => getInitialSeconds('focus25', '50'));
  const [elapsedStopwatch, setElapsedStopwatch] = useState(0);
  const [running, setRunning] = useState(false);
  const completedRef = useRef(false);

  const totalTargetSeconds = getInitialSeconds(preset, customMinutes);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      if (mode === 'pomodoro') {
        setSecondsLeft((prev) => {
          if (prev <= 1) {
            setRunning(false);
            if (!completedRef.current) {
              completedRef.current = true;
              playTacticalChime('complete', workspace?.user.soundEnabled, workspace?.user.soundVolume);
              triggerHaptic(workspace?.user.hapticsEnabled);
              if (workspace) {
                const mins = Math.max(1, Math.round(totalTargetSeconds / 60));
                logFocusSession({
                  mode: 'pomodoro',
                  durationMinutes: mins,
                  label: label.trim() || 'Pomodoro Focus',
                  date: workspace.today,
                });
              }
            }
            return 0;
          }
          return prev - 1;
        });
      } else {
        setElapsedStopwatch((prev) => prev + 1);
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [running, mode, totalTargetSeconds, label, workspace, logFocusSession]);

  if (!workspace) {
    return (
      <AppShell title="Deep Focus">
        <div className="card-surface p-6 text-sm text-muted-foreground">Loading focus suite...</div>
      </AppShell>
    );
  }

  const selectPreset = (p: TimerPreset) => {
    setRunning(false);
    completedRef.current = false;
    setPreset(p);
    setSecondsLeft(getInitialSeconds(p, customMinutes));
  };

  const toggleRun = () => {
    if (!running) {
      completedRef.current = false;
      playTacticalChime('start', workspace.user.soundEnabled, workspace.user.soundVolume);
    } else {
      playTacticalChime('pause', workspace.user.soundEnabled, workspace.user.soundVolume);
    }
    triggerHaptic(workspace.user.hapticsEnabled);
    setRunning(!running);
  };

  const handleReset = () => {
    setRunning(false);
    completedRef.current = false;
    if (mode === 'pomodoro') {
      setSecondsLeft(getInitialSeconds(preset, customMinutes));
    } else {
      setElapsedStopwatch(0);
    }
  };

  const handleLogManual = async () => {
    setRunning(false);
    const loggedMins =
      mode === 'pomodoro'
        ? Math.max(1, Math.round((totalTargetSeconds - secondsLeft) / 60) || Math.round(totalTargetSeconds / 60))
        : Math.max(1, Math.round(elapsedStopwatch / 60));

    playTacticalChime('complete', workspace.user.soundEnabled, workspace.user.soundVolume);
    await logFocusSession({
      mode,
      durationMinutes: loggedMins,
      label: label.trim() || (mode === 'pomodoro' ? 'Deep Focus' : 'Open Stopwatch'),
      date: workspace.today,
    });
    handleReset();
  };

  const displaySeconds = mode === 'pomodoro' ? secondsLeft : elapsedStopwatch;
  const minsStr = String(Math.floor(displaySeconds / 60)).padStart(2, '0');
  const secsStr = String(displaySeconds % 60).padStart(2, '0');

  const progressRatio =
    mode === 'pomodoro'
      ? Math.max(0, Math.min(1, (totalTargetSeconds - secondsLeft) / Math.max(1, totalTargetSeconds)))
      : Math.min(1, (elapsedStopwatch % 3600) / 3600);

  const radius = 104;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - progressRatio * circumference;

  const todayMins = workspace.focusSessions
    .filter((s) => s.date === workspace.today)
    .reduce((sum, s) => sum + s.durationMinutes, 0);

  return (
    <AppShell title="Deep Focus">
      <PageHeading
        title="Deep Focus & Productivity Suite"
        subtitle="Uninterrupted cognitive execution (+10 XP per logged session)"
        action={
          <div className="flex items-center gap-2.5 rounded-xl border border-border bg-surface px-3.5 py-2">
            <Shield className="h-4 w-4 text-primary" />
            <span className="text-xs font-medium">Deep Work Mode</span>
            <Switch
              checked={workspace.user.focusModeEnabled}
              onCheckedChange={(checked) => updateProfile({ focusModeEnabled: checked })}
            />
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Main Timer Surface */}
        <div className="lg:col-span-7 card-surface p-6 sm:p-8 flex flex-col items-center gap-6">
          <Tabs
            value={mode}
            onValueChange={(v) => {
              setRunning(false);
              setMode(v as 'pomodoro' | 'stopwatch');
            }}
          >
            <TabsList>
              <TabsTrigger value="pomodoro">Pomodoro</TabsTrigger>
              <TabsTrigger value="stopwatch">Stopwatch</TabsTrigger>
            </TabsList>
          </Tabs>

          {mode === 'pomodoro' && (
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button
                size="sm"
                variant={preset === 'focus25' ? 'default' : 'outline'}
                onClick={() => selectPreset('focus25')}
              >
                Focus 25m
              </Button>
              <Button
                size="sm"
                variant={preset === 'short5' ? 'default' : 'outline'}
                onClick={() => selectPreset('short5')}
              >
                Short Break 5m
              </Button>
              <Button
                size="sm"
                variant={preset === 'long15' ? 'default' : 'outline'}
                onClick={() => selectPreset('long15')}
              >
                Long Break 15m
              </Button>
              <div className="flex items-center gap-1.5">
                <Input
                  type="number"
                  min={1}
                  max={180}
                  value={customMinutes}
                  onChange={(e) => {
                    setCustomMinutes(e.target.value);
                    if (preset === 'custom') {
                      setSecondsLeft(getInitialSeconds('custom', e.target.value));
                    }
                  }}
                  className="w-20 h-9 num text-center"
                />
                <Button
                  size="sm"
                  variant={preset === 'custom' ? 'default' : 'outline'}
                  onClick={() => selectPreset('custom')}
                >
                  Custom
                </Button>
              </div>
            </div>
          )}

          {/* Concentric Ring Timer */}
          <div className="relative flex items-center justify-center w-60 h-60">
            <svg width={240} height={240} viewBox="0 0 240 240" className="-rotate-90">
              <circle cx={120} cy={120} r={radius} fill="none" stroke="var(--surface)" strokeWidth={12} />
              <circle
                cx={120}
                cy={120}
                r={radius}
                fill="none"
                stroke="var(--primary)"
                strokeWidth={12}
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                style={{ transition: 'stroke-dashoffset 400ms linear' }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="num text-5xl font-bold tracking-tight">
                {minsStr}:{secsStr}
              </span>
              <span className="text-xs text-muted-foreground mt-2 uppercase tracking-[0.12em]">
                {running ? 'Locked In' : 'Standby'}
              </span>
            </div>
          </div>

          <div className="w-full max-w-sm space-y-3">
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Session objective (e.g., System Architecture)"
            />
            <div className="flex items-center justify-center gap-2.5">
              <Button size="lg" onClick={toggleRun} className="flex-1 glow-primary">
                {running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                {running ? 'Pause' : 'Start Focus'}
              </Button>
              <Button size="lg" variant="outline" onClick={handleReset} aria-label="Reset timer">
                <RotateCcw className="h-4 w-4" />
              </Button>
              <Button size="lg" variant="secondary" onClick={handleLogManual}>
                <CheckCircle2 className="h-4 w-4" />
                Log
              </Button>
            </div>
          </div>
        </div>

        {/* Metrics & Session History */}
        <div className="lg:col-span-5 space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <StatTile label="Today Focus" value={todayMins} suffix="m" tone="primary" icon={Timer} />
            <StatTile label="Total Sessions" value={workspace.focusSessions.length} tone="success" />
          </div>

          <div className="card-surface p-5 space-y-4">
            <SectionHeader title="Session History" subtitle="Automatically reflected in Analytics & XP" />
            {workspace.focusSessions.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">No focus sessions recorded yet.</p>
            ) : (
              <div className="divide-y divide-border/60 max-h-80 overflow-y-auto">
                {workspace.focusSessions.slice(0, 15).map((s) => (
                  <div key={s.id} className="py-2.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{s.label}</p>
                      <p className="text-xs text-muted-foreground">
                        <span className="capitalize">{s.mode}</span> · <span className="num">{s.date}</span>
                      </p>
                    </div>
                    <span className="num text-sm font-semibold text-primary shrink-0">
                      {s.durationMinutes}m
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
