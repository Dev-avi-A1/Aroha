import React from 'react';
import { Link } from 'react-router-dom';
import { Flame, Trophy } from 'lucide-react';
import { useWorkspace } from '@/context/WorkspaceContext';
import { RANK_LADDER } from '@/lib/xp';
import { AppShell } from '@/components/aroha/app-shell';
import { Meter, PageHeading, SectionHeader, StatTile } from '@/components/aroha/primitives';
import { Button } from '@/components/ui/button';

export function LevelPage() {
  const { workspace } = useWorkspace();

  if (!workspace) {
    return (
      <AppShell title="Level & Progression">
        <div className="card-surface p-6 text-sm text-muted-foreground">Calculating XP...</div>
      </AppShell>
    );
  }

  const { xp } = workspace;
  const rows = [
    { label: 'Habit Check-ins (×12 XP)', val: xp.components.checkinsXp },
    { label: 'Completed Schedule Blocks (×6 XP)', val: xp.components.blocksXp },
    { label: 'Best Habit Streak (×20 XP)', val: xp.components.streakXp },
    { label: 'Achievement Badges (×75 XP)', val: xp.components.badgesXp },
    { label: 'Deep Focus Sessions (×10 XP)', val: xp.components.focusXp },
    { label: 'Journal Reflection Days (×15 XP)', val: xp.components.journalXp },
    { label: 'Health Recovery Days (×5 XP)', val: xp.components.healthXp },
    { label: 'Goals Completed (×50 XP)', val: xp.components.goalsXp },
    { label: 'Today Discipline Score (+Score)', val: xp.components.disciplineXp },
  ];

  return (
    <AppShell
      title="Level & XP"
      headerAction={
        <Button asChild size="sm" variant="outline">
          <Link to="/achievements">
            <Trophy className="h-3.5 w-3.5" /> Badges
          </Link>
        </Button>
      }
    >
      <PageHeading
        title={`Level ${xp.level} — ${xp.rank}`}
        subtitle="Mathematical XP progression compounded across every AROHA protocol"
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatTile label="Total XP" value={xp.totalXp} suffix="XP" tone="primary" icon={Flame} />
        <StatTile label="Current Level" value={xp.level} tone="success" />
        <StatTile label="Current Rank" value={xp.rank} tone="warning" />
      </div>

      <div className="card-surface p-6 space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">Progress to Level {xp.level + 1}</span>
          <span className="num text-primary font-semibold">
            {xp.currentLevelXp} / {xp.nextLevelXp} XP ({xp.progressPercent}%)
          </span>
        </div>
        <Meter value={xp.progressPercent} max={100} tone="primary" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="card-surface p-6 space-y-4">
          <SectionHeader title="XP Formula Breakdown" subtitle="Transparent weighted attribution" />
          <div className="divide-y divide-border/60">
            {rows.map((r) => (
              <div key={r.label} className="py-2.5 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{r.label}</span>
                <span className="num font-semibold text-foreground">+{r.val} XP</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card-surface p-6 space-y-4">
          <SectionHeader title="Rank Ladder" subtitle="Six mastery tiers from Novice to Sovereign" />
          <div className="space-y-3">
            {RANK_LADDER.map((tier) => {
              const active = xp.rank === tier.name;
              const unlocked = xp.level >= tier.minLevel;
              return (
                <div
                  key={tier.name}
                  className={`rounded-xl border p-3.5 ${
                    active
                      ? 'border-primary bg-primary-soft'
                      : unlocked
                        ? 'border-border bg-surface/80'
                        : 'border-border/50 bg-surface/30 opacity-65'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">{tier.name}</span>
                    <span className="num text-xs text-muted-foreground">
                      Lv.{tier.minLevel}{tier.maxLevel < 100 ? `–${tier.maxLevel}` : '+'}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{tier.directive}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
