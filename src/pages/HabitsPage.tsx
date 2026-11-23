import React, { useState } from 'react';
import { Check, Edit3, Flame, Plus, Trash2 } from 'lucide-react';
import { useWorkspace, type HabitItem } from '@/context/WorkspaceContext';
import { shiftDateISO } from '@/lib/presets';
import { playTacticalChime, triggerHaptic } from '@/lib/audio';
import { AppShell } from '@/components/aroha/app-shell';
import { PageHeading, StatTile } from '@/components/aroha/primitives';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

export function HabitsPage() {
  const { workspace, createHabit, updateHabit, deleteHabit, toggleHabitCheckin } = useWorkspace();
  const [cadenceFilter, setCadenceFilter] = useState<'all' | 'daily' | 'weekly' | 'monthly'>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingHabit, setEditingHabit] = useState<HabitItem | null>(null);

  const [title, setTitle] = useState('');
  const [cadence, setCadence] = useState<HabitItem['cadence']>('daily');
  const [targetQuantity, setTargetQuantity] = useState('1');
  const [unit, setUnit] = useState('check');
  const [color, setColor] = useState<HabitItem['color']>('primary');

  if (!workspace) {
    return (
      <AppShell title="Habits">
        <div className="card-surface p-6 text-sm text-muted-foreground">Loading habits...</div>
      </AppShell>
    );
  }

  const last30Days = Array.from({ length: 30 }, (_, idx) => shiftDateISO(workspace.today, -(29 - idx)));
  const filteredHabits =
    cadenceFilter === 'all' ? workspace.habits : workspace.habits.filter((h) => h.cadence === cadenceFilter);

  const todayDone = workspace.habits.filter((h) =>
    workspace.habitCheckins.some((c) => c.habitId === h.id && c.date === workspace.today)
  ).length;
  const maxStreak = workspace.habits.reduce((m, h) => Math.max(m, h.bestStreak), 0);

  const openCreate = () => {
    setEditingHabit(null);
    setTitle('');
    setCadence('daily');
    setTargetQuantity('1');
    setUnit('check');
    setColor('primary');
    setDialogOpen(true);
  };

  const openEdit = (h: HabitItem) => {
    setEditingHabit(h);
    setTitle(h.title);
    setCadence(h.cadence);
    setTargetQuantity(String(h.targetQuantity));
    setUnit(h.unit);
    setColor(h.color);
    setDialogOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const payload = {
      title: title.trim(),
      cadence,
      targetQuantity: Math.max(1, Number.parseInt(targetQuantity, 10) || 1),
      unit: unit.trim() || 'check',
      color,
    };
    if (editingHabit) {
      await updateHabit(editingHabit.id, payload);
    } else {
      await createHabit(payload);
    }
    setDialogOpen(false);
  };

  const handleToggleDate = async (habitId: number, dateStr: string) => {
    playTacticalChime('start', workspace.user.soundEnabled, workspace.user.soundVolume);
    triggerHaptic(workspace.user.hapticsEnabled);
    await toggleHabitCheckin(habitId, dateStr);
  };

  return (
    <AppShell
      title="Habits & Streaks"
      headerAction={
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" /> New Habit
        </Button>
      }
    >
      <PageHeading
        title="Habit Streak Engine"
        subtitle="Compound unbroken daily, weekly, and monthly protocols (+12 XP per check-in)"
      />

      <div className="grid grid-cols-3 gap-3">
        <StatTile label="Today Complete" value={`${todayDone}/${workspace.habits.length}`} tone="success" />
        <StatTile label="Total Check-ins" value={workspace.habitCheckins.length} tone="primary" />
        <StatTile label="Best Streak" value={maxStreak} suffix="d" tone="warning" icon={Flame} />
      </div>

      <Tabs value={cadenceFilter} onValueChange={(v) => setCadenceFilter(v as typeof cadenceFilter)}>
        <TabsList>
          <TabsTrigger value="all">All ({workspace.habits.length})</TabsTrigger>
          <TabsTrigger value="daily">Daily</TabsTrigger>
          <TabsTrigger value="weekly">Weekly</TabsTrigger>
          <TabsTrigger value="monthly">Monthly</TabsTrigger>
        </TabsList>
      </Tabs>

      {filteredHabits.length === 0 ? (
        <div className="card-surface p-8 text-center space-y-3">
          <p className="text-sm text-muted-foreground">No habits match this cadence filter.</p>
          <Button onClick={openCreate}>Create First Habit</Button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredHabits.map((habit) => {
            const checkinDates = new Set(
              workspace.habitCheckins.filter((c) => c.habitId === habit.id).map((c) => c.date)
            );
            const checkedToday = checkinDates.has(workspace.today);

            return (
              <div key={habit.id} className="card-surface p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <button
                      type="button"
                      onClick={() => handleToggleDate(habit.id, workspace.today)}
                      className={`h-9 w-9 rounded-xl border flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                        checkedToday
                          ? 'bg-success border-success text-background'
                          : 'border-border bg-surface text-muted-foreground hover:border-primary'
                      }`}
                      aria-label="Toggle today check-in"
                    >
                      <Check className="h-4 w-4 stroke-[2.5]" />
                    </button>
                    <div className="min-w-0">
                      <h3 className="text-base font-semibold truncate">{habit.title}</h3>
                      <p className="text-xs text-muted-foreground">
                        <span className="capitalize">{habit.cadence}</span>
                        {' · '}Goal: <span className="num">{habit.targetQuantity}</span> {habit.unit}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-end sm:self-center shrink-0">
                    <div className="text-right">
                      <p className="num text-sm font-semibold text-warning flex items-center gap-1 justify-end">
                        <Flame className="h-3.5 w-3.5" /> {habit.currentStreak}d
                      </p>
                      <p className="num text-[11px] text-muted-foreground">Best {habit.bestStreak}d</p>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(habit)} aria-label="Edit habit">
                      <Edit3 className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => deleteHabit(habit.id)} aria-label="Delete habit">
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>

                {/* 30-Day Dot Matrix */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>30-Day Matrix</span>
                    <span className="num">{last30Days.filter((d) => checkinDates.has(d)).length}/30 days</span>
                  </div>
                  <div className="grid grid-cols-15 sm:grid-cols-30 gap-1.5">
                    {last30Days.map((d) => {
                      const active = checkinDates.has(d);
                      const isToday = d === workspace.today;
                      return (
                        <button
                          key={d}
                          type="button"
                          title={`${d}${active ? ' — Completed' : ' — Missed'}`}
                          onClick={() => handleToggleDate(habit.id, d)}
                          className={`h-5 w-full rounded-sm transition-colors cursor-pointer ${
                            active
                              ? 'bg-success hover:bg-success/80'
                              : 'bg-surface hover:bg-accent'
                          } ${isToday ? 'ring-1 ring-primary' : ''}`}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingHabit ? 'Edit Habit' : 'Create Habit Protocol'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Habit Name</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., 05:30 Cold Exposure"
                required
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Cadence</label>
                <Select value={cadence} onValueChange={(v) => setCadence(v as HabitItem['cadence'])}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Target Qty</label>
                <Input
                  type="number"
                  min={1}
                  value={targetQuantity}
                  onChange={(e) => setTargetQuantity(e.target.value)}
                  className="num"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Unit</label>
                <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="minutes / ml" required />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">{editingHabit ? 'Save Changes' : 'Create Habit'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
