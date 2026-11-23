import React, { useState } from 'react';
import { Activity, Droplets, Dumbbell, Moon, RotateCcw } from 'lucide-react';
import { useWorkspace } from '@/context/WorkspaceContext';
import { playTacticalChime, triggerHaptic } from '@/lib/audio';
import { AppShell } from '@/components/aroha/app-shell';
import { Meter, PageHeading, SectionHeader, StatTile } from '@/components/aroha/primitives';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

const SLEEP_PRESETS = [6, 7, 7.5, 8, 9];

export function HealthPage() {
  const { workspace, updateHealth } = useWorkspace();
  const [trainingNote, setTrainingNote] = useState('');

  React.useEffect(() => {
    if (workspace?.todayHealth.trainingNote !== undefined) {
      setTrainingNote(workspace.todayHealth.trainingNote);
    }
  }, [workspace?.todayHealth.trainingNote]);

  if (!workspace) {
    return (
      <AppShell title="Health">
        <div className="card-surface p-6 text-sm text-muted-foreground">Loading biological metrics...</div>
      </AppShell>
    );
  }

  const health = workspace.todayHealth;
  const waterPct = Math.min(100, Math.round((health.waterMl / Math.max(1, health.waterTargetMl)) * 100));
  const sleepPct = Math.min(100, Math.round((health.sleepHours / Math.max(1, health.sleepTargetHours)) * 100));

  const addWater = async (delta: number) => {
    playTacticalChime('start', workspace.user.soundEnabled, workspace.user.soundVolume);
    triggerHaptic(workspace.user.hapticsEnabled);
    await updateHealth({ date: workspace.today, waterDeltaMl: delta });
  };

  return (
    <AppShell title="Health & Biology">
      <PageHeading
        title="Health & Biological Inputs"
        subtitle="Physical recovery is the prerequisite to sustained mental discipline (+5 XP/day)"
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatTile label="Hydration" value={health.waterMl} suffix="ml" tone="primary" icon={Droplets} />
        <StatTile label="Sleep Logged" value={health.sleepHours} suffix="h" tone="success" icon={Moon} />
        <StatTile label="Training" value={health.trained ? 'Logged' : 'Pending'} tone={health.trained ? 'success' : 'warning'} icon={Dumbbell} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Hydration Tracker */}
        <div className="card-surface p-6 space-y-5">
          <SectionHeader
            title="Hydration Tracker"
            subtitle={`Target ${health.waterTargetMl} ml · ${waterPct}% complete`}
            action={
              <Button
                variant="ghost"
                size="icon"
                onClick={() => updateHealth({ date: workspace.today, waterMl: 0 })}
                aria-label="Reset today's hydration"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            }
          />

          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="num text-3xl font-bold text-secondary">{health.waterMl} ml</span>
              <span className="num text-xs text-muted-foreground">/ {health.waterTargetMl} ml</span>
            </div>
            <Meter value={health.waterMl} max={health.waterTargetMl} tone="secondary" />
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            {[250, 500, 750].map((ml) => (
              <Button key={ml} variant="outline" onClick={() => addWater(ml)} className="num">
                +{ml} ml
              </Button>
            ))}
          </div>
        </div>

        {/* Sleep Duration & Quality */}
        <div className="card-surface p-6 space-y-5">
          <SectionHeader
            title="Sleep Quality & Duration"
            subtitle={`Target ${health.sleepTargetHours}h · ${sleepPct}% recovered`}
          />

          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="num text-3xl font-bold text-success">{health.sleepHours}h</span>
              <span className="text-xs text-muted-foreground capitalize">Quality: {health.sleepQuality}</span>
            </div>
            <Meter value={health.sleepHours} max={health.sleepTargetHours} tone="success" />
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {SLEEP_PRESETS.map((hrs) => (
                <Button
                  key={hrs}
                  size="sm"
                  variant={health.sleepHours === hrs ? 'default' : 'outline'}
                  onClick={() => updateHealth({ date: workspace.today, sleepHours: hrs })}
                  className="num"
                >
                  {hrs}h
                </Button>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground shrink-0">Sleep Quality</span>
              <Select
                value={health.sleepQuality}
                onValueChange={(val) => updateHealth({ date: workspace.today, sleepQuality: val })}
              >
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="poor">Poor</SelectItem>
                  <SelectItem value="fair">Fair</SelectItem>
                  <SelectItem value="good">Good</SelectItem>
                  <SelectItem value="optimal">Optimal</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* Physical Training Protocol */}
      <div className="card-surface p-6 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary-soft text-primary flex items-center justify-center">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold">Physical Conditioning Log</h3>
              <p className="text-xs text-muted-foreground">Counts toward the Iron Month 30-day badge</p>
            </div>
          </div>
          <Switch
            checked={health.trained}
            onCheckedChange={(checked) => updateHealth({ date: workspace.today, trained: checked, trainingNote })}
          />
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            updateHealth({ date: workspace.today, trained: true, trainingNote });
          }}
          className="flex flex-col sm:flex-row gap-2.5"
        >
          <Input
            value={trainingNote}
            onChange={(e) => setTrainingNote(e.target.value)}
            placeholder="Session notes (e.g., 5km tempo run + upper push)"
          />
          <Button type="submit" variant="outline" className="shrink-0">
            Save Training Note
          </Button>
        </form>
      </div>
    </AppShell>
  );
}
