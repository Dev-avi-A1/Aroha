import React from 'react';
import { Lock, Trophy } from 'lucide-react';
import { useWorkspace } from '@/context/WorkspaceContext';
import { AppShell } from '@/components/aroha/app-shell';
import { Meter, PageHeading, StatTile } from '@/components/aroha/primitives';

export function AchievementsPage() {
  const { workspace } = useWorkspace();

  if (!workspace) {
    return (
      <AppShell title="Achievements">
        <div className="card-surface p-6 text-sm text-muted-foreground">Evaluating badges...</div>
      </AppShell>
    );
  }

  const unlockedCount = workspace.achievements.filter((a) => a.unlocked).length;

  return (
    <AppShell title="Achievements">
      <PageHeading
        title="Achievements & Milestones"
        subtitle="Verified discipline badges awarding +75 XP each upon unlock"
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatTile label="Unlocked" value={`${unlockedCount}/${workspace.achievements.length}`} tone="success" icon={Trophy} />
        <StatTile label="Badge XP Earned" value={unlockedCount * 75} suffix="XP" tone="warning" />
        <StatTile label="Current Rank" value={workspace.xp.rank} tone="primary" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {workspace.achievements.map((badge) => (
          <div
            key={badge.key}
            className={`card-surface p-5 space-y-3 ${badge.unlocked ? 'border-success/60' : ''}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${
                    badge.unlocked ? 'bg-success/15 text-success' : 'bg-surface text-muted-foreground'
                  }`}
                >
                  {badge.unlocked ? <Trophy className="h-5 w-5" /> : <Lock className="h-4 w-4" />}
                </div>
                <div>
                  <h3 className="text-base font-semibold">{badge.title}</h3>
                  <p className="text-xs text-muted-foreground">{badge.metricLabel} · +{badge.xpBonus} XP</p>
                </div>
              </div>
              <span className={`text-xs font-semibold ${badge.unlocked ? 'text-success' : 'text-muted-foreground'}`}>
                {badge.unlocked ? 'Unlocked' : `${badge.progress}%`}
              </span>
            </div>

            <p className="text-sm text-muted-foreground">{badge.description}</p>
            <Meter value={badge.progress} tone={badge.unlocked ? 'success' : 'primary'} />
          </div>
        ))}
      </div>
    </AppShell>
  );
}
