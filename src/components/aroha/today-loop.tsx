import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Clock } from 'lucide-react';
import { useWorkspace } from '@/context/WorkspaceContext';
import { durationLabel, timeToMinutes } from '@/lib/presets';
import { formatTimeInTimezone } from '@/lib/utils';
import { playTacticalChime, triggerHaptic } from '@/lib/audio';
import { Button } from '@/components/ui/button';
import { Meter } from './primitives';

export function TodayLoop() {
  const { workspace, updateBlock } = useWorkspace();
  const [nowClock, setNowClock] = useState(() =>
    formatTimeInTimezone(workspace?.user.timezone || 'UTC')
  );

  useEffect(() => {
    const tick = () => setNowClock(formatTimeInTimezone(workspace?.user.timezone || 'UTC'));
    tick();
    const id = window.setInterval(tick, 15000);
    return () => window.clearInterval(id);
  }, [workspace?.user.timezone]);

  if (!workspace) return null;

  const todayBlocks = workspace.scheduleBlocks
    .filter((b) => b.date === workspace.today)
    .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));

  const nowMinutes = timeToMinutes(nowClock);
  const currentBlock =
    todayBlocks.find(
      (b) => !b.completed && timeToMinutes(b.startTime) <= nowMinutes && timeToMinutes(b.endTime) > nowMinutes
    ) || todayBlocks.find((b) => !b.completed);

  const nextBlock = currentBlock
    ? todayBlocks.find(
        (b) => b.id !== currentBlock.id && !b.completed && timeToMinutes(b.startTime) >= timeToMinutes(currentBlock.startTime)
      )
    : undefined;

  if (todayBlocks.length === 0) {
    return (
      <div className="card-surface p-6 h-full flex flex-col justify-between gap-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold">Today&apos;s Mission</h3>
            <span className="num text-xs text-muted-foreground">{nowClock}</span>
          </div>
          <p className="text-sm text-muted-foreground">
            No time blocks scheduled for today. Apply Monk Mode or craft your protocol.
          </p>
        </div>
        <div>
          <Button asChild size="sm">
            <Link to="/schedule">Open Schedule</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!currentBlock) {
    return (
      <div className="card-surface p-6 h-full flex flex-col justify-between gap-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-success flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              All Blocks Executed
            </h3>
            <span className="num text-xs text-muted-foreground">{todayBlocks.length}/{todayBlocks.length}</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Every scheduled block for {workspace.today} is complete. Proceed to evening reflection.
          </p>
        </div>
        <div>
          <Button asChild variant="outline" size="sm">
            <Link to="/journal">Log Evening Reflection</Link>
          </Button>
        </div>
      </div>
    );
  }

  const startMins = timeToMinutes(currentBlock.startTime);
  const endMins = timeToMinutes(currentBlock.endTime);
  const totalSpan = Math.max(1, endMins - startMins);
  const elapsed = Math.max(0, Math.min(totalSpan, nowMinutes - startMins));
  const remaining = Math.max(0, endMins - nowMinutes);
  const isLiveNow = nowMinutes >= startMins && nowMinutes < endMins;

  const handleComplete = async () => {
    playTacticalChime('complete', workspace.user.soundEnabled, workspace.user.soundVolume);
    triggerHaptic(workspace.user.hapticsEnabled);
    await updateBlock(currentBlock.id, { completed: true });
  };

  return (
    <div className="card-surface p-6 h-full flex flex-col justify-between gap-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-[0.12em] text-primary">
          {isLiveNow ? 'Active Mission Block' : 'Next Scheduled Block'}
        </span>
        <span className="num text-xs text-muted-foreground flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" />
          {currentBlock.startTime} – {currentBlock.endTime} · {durationLabel(currentBlock.startTime, currentBlock.endTime)}
        </span>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <h3 className="text-lg font-semibold text-foreground truncate">{currentBlock.title}</h3>
          <p className="text-xs text-muted-foreground">
            Priority: <span className="capitalize text-foreground">{currentBlock.priority}</span>
            <span className="mx-1.5">·</span>
            {isLiveNow ? (
              <span className="num text-primary">{remaining}m remaining</span>
            ) : (
              <span className="num">Local time {nowClock}</span>
            )}
          </p>
        </div>

        <Button onClick={handleComplete} className="shrink-0 glow-primary">
          <CheckCircle2 className="h-4 w-4" />
          Complete Block
        </Button>
      </div>

      <Meter value={isLiveNow ? elapsed : 0} max={totalSpan} tone="primary" />

      {nextBlock && (
        <div className="pt-2 border-t border-border/70 flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span className="truncate">
            Up next: <span className="text-foreground font-medium">{nextBlock.title}</span> ({nextBlock.startTime})
          </span>
          <Link to="/schedule" className="shrink-0 inline-flex items-center gap-1 text-primary hover:underline">
            Timeline <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      )}
    </div>
  );
}
