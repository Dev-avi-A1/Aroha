import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BookOpenText,
  Check,
  Droplets,
  Flame,
  Moon,
  Timer,
  Zap,
} from 'lucide-react';
import { useWorkspace } from '@/context/WorkspaceContext';
import { getGreetingForTimezone } from '@/lib/utils';
import { playTacticalChime, triggerHaptic } from '@/lib/audio';
import { AppShell } from '@/components/aroha/app-shell';
import { Meter, PageHeading, ScoreRing, SectionHeader, StatTile } from '@/components/aroha/primitives';
import { TodayLoop } from '@/components/aroha/today-loop';
import { Button } from '@/components/ui/button';

export function HomePage() {
  const { workspace, toggleHabitCheckin } = useWorkspace();

  if (!workspace) {
    return (
      <AppShell title="Command Center">
        <div className="card-surface p-6 text-sm text-muted-foreground">Loading telemetry...</div>
      </AppShell>
    );
  }

  const greeting = getGreetingForTimezone(workspace.user.timezone);
  const todayBlocks = workspace.scheduleBlocks.filter((b) => b.date === workspace.today);
  const completedTodayBlocks = todayBlocks.filter((b) => b.completed).length;
  const todayCheckinSet = new Set(
    workspace.habitCheckins.filter((c) => c.date === workspace.today).map((c) => c.habitId)
  );
  const focusMinsToday = workspace.focusSessions
    .filter((f) => f.date === workspace.today)
    .reduce((sum, f) => sum + f.durationMinutes, 0);

  const handleToggleHabit = async (habitId: number) => {
    playTacticalChime('start', workspace.user.soundEnabled, workspace.user.soundVolume);
    triggerHaptic(workspace.user.hapticsEnabled);
    await toggleHabitCheckin(habitId, workspace.today);
  };

  return (
    <AppShell
      title="Command Center"
      headerAction={
        <Button asChild size="sm" variant="outline">
          <Link to="/coach">AROHA AI</Link>
        </Button>
      }
    >
      <PageHeading
        title={`${greeting}, ${workspace.user.displayName}`}
        subtitle={`${workspace.today} · ${workspace.user.timezone} · ${workspace.xp.rank} Rank`}
        action={
          <Button asChild size="sm">
            <Link to="/focus">Start Focus</Link>
          </Button>
        }
      />

      {/* Top Hero Telemetry Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        <div className="lg:col-span-4 card-surface p-6 flex flex-col items-center justify-center gap-4">
          <ScoreRing
            value={workspace.disciplineScore}
            size={180}
            label="Discipline"
            caption={workspace.disciplineStatus}
          />
          <div className="w-full pt-3 border-t border-border/70 flex items-center justify-between text-xs text-muted-foreground">
            <span>Blocks {completedTodayBlocks}/{todayBlocks.length}</span>
            <span>Habits {todayCheckinSet.size}/{workspace.habits.length}</span>
          </div>
        </div>

        <div className="lg:col-span-8">
          <TodayLoop />
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile
          label="Focus Today"
          value={focusMinsToday}
          suffix="m"
          tone="primary"
          icon={Timer}
        />
        <StatTile
          label="Hydration"
          value={workspace.todayHealth.waterMl}
          suffix="ml"
          tone="default"
          icon={Droplets}
        />
        <StatTile
          label="Sleep"
          value={workspace.todayHealth.sleepHours}
          suffix="h"
          tone="success"
          icon={Moon}
        />
        <StatTile
          label="Total XP"
          value={workspace.xp.totalXp}
          suffix="XP"
          tone="warning"
          icon={Zap}
        />
      </div>

      {/* Habits Quick Action + Health & Progression */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-7 card-surface p-5 space-y-4">
          <SectionHeader
            title="Habit Quick Action"
            subtitle="1-tap protocol execution (+12 XP per check-in)"
            action={
              <Link to="/habits" className="text-xs text-primary hover:underline inline-flex items-center gap-1">
                All Habits <ArrowRight className="h-3 w-3" />
              </Link>
            }
          />
          <div className="divide-y divide-border/60">
            {workspace.habits.map((habit) => {
              const checked = todayCheckinSet.has(habit.id);
              return (
                <button
                  key={habit.id}
                  type="button"
                  onClick={() => handleToggleHabit(habit.id)}
                  className="w-full py-3 flex items-center justify-between gap-3 text-left hover:bg-accent/35 px-2 -mx-2 rounded-xl transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`h-6 w-6 rounded-lg border flex items-center justify-center shrink-0 transition-colors ${
                        checked
                          ? 'bg-success border-success text-background'
                          : 'border-border bg-surface text-transparent'
                      }`}
                    >
                      <Check className="h-3.5 w-3.5 stroke-[2.5]" />
                    </span>
                    <div className="min-w-0">
                      <p className={`text-sm font-medium truncate ${checked ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                        {habit.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Target: <span className="num">{habit.targetQuantity}</span> {habit.unit} · <span className="capitalize">{habit.cadence}</span>
                      </p>
                    </div>
                  </div>
                  <div className="shrink-0 flex items-center gap-1 text-xs text-warning">
                    <Flame className="h-3.5 w-3.5" />
                    <span className="num font-semibold">{habit.currentStreak}d</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-5 space-y-5">
          {/* Health Snapshot */}
          <div className="card-surface p-5 space-y-4">
            <SectionHeader
              title="Biological Snapshot"
              action={
                <Link to="/health" className="text-xs text-primary hover:underline">
                  Log Inputs
                </Link>
              }
            />
            <div className="space-y-3">
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Hydration</span>
                  <span className="num text-secondary">
                    {workspace.todayHealth.waterMl} / {workspace.todayHealth.waterTargetMl} ml
                  </span>
                </div>
                <Meter value={workspace.todayHealth.waterMl} max={workspace.todayHealth.waterTargetMl} tone="secondary" />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Sleep Recovery</span>
                  <span className="num text-success">
                    {workspace.todayHealth.sleepHours} / {workspace.todayHealth.sleepTargetHours} h
                  </span>
                </div>
                <Meter value={workspace.todayHealth.sleepHours} max={workspace.todayHealth.sleepTargetHours} tone="success" />
              </div>
            </div>
          </div>

          {/* Progression Status */}
          <div className="card-surface p-5 space-y-3">
            <SectionHeader
              title="Progression Status"
              action={
                <Link to="/level" className="text-xs text-primary hover:underline">
                  Breakdown
                </Link>
              }
            />
            <div className="flex items-baseline justify-between">
              <div>
                <p className="text-xl font-bold">{workspace.xp.rank}</p>
                <p className="text-xs text-muted-foreground">Level {workspace.xp.level}</p>
              </div>
              <div className="text-right">
                <p className="num text-sm font-semibold text-primary">
                  {workspace.xp.currentLevelXp} / {workspace.xp.nextLevelXp} XP
                </p>
                <p className="text-xs text-muted-foreground">To Level {workspace.xp.level + 1}</p>
              </div>
            </div>
            <Meter value={workspace.xp.progressPercent} max={100} tone="primary" />
          </div>
        </div>
      </div>

      {/* Daily Quote at Bottom of Home Page */}
      <section aria-label="Daily quote" className="card-surface p-6 space-y-3">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.12em] text-primary">
          <BookOpenText className="h-3.5 w-3.5" />
          <span>Daily Wisdom</span>
        </div>

        <p className="text-lg sm:text-xl font-semibold text-foreground leading-relaxed tracking-wide">
          {workspace.quote.text}
        </p>
        <p className="text-xs sm:text-sm italic text-muted-foreground">
          {workspace.quote.transliteration}
        </p>
        <p className="text-sm sm:text-base text-foreground/90 leading-relaxed">
          &ldquo;{workspace.quote.translation}&rdquo;
        </p>
        <p className="text-xs font-medium text-primary">— {workspace.quote.author}</p>
      </section>
    </AppShell>
  );
}
