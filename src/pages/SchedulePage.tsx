import React, { useState } from 'react';
import { ArrowDown, ArrowUp, Calendar, Check, Edit3, Plus, Trash2 } from 'lucide-react';
import { useWorkspace, type ScheduleBlock } from '@/context/WorkspaceContext';
import { durationLabel, shiftDateISO, timeToMinutes } from '@/lib/presets';
import { playTacticalChime, triggerHaptic } from '@/lib/audio';
import { AppShell } from '@/components/aroha/app-shell';
import { PageHeading, SectionHeader } from '@/components/aroha/primitives';
import { CustomTemplates } from '@/components/aroha/custom-templates';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const COLOR_DOT: Record<ScheduleBlock['color'], string> = {
  primary: 'bg-primary',
  secondary: 'bg-secondary',
  success: 'bg-success',
  warning: 'bg-warning',
  destructive: 'bg-destructive',
};

const PRIORITY_TEXT: Record<ScheduleBlock['priority'], string> = {
  high: 'text-destructive',
  medium: 'text-warning',
  low: 'text-success',
};

export function SchedulePage() {
  const { workspace, createBlock, updateBlock, deleteBlock } = useWorkspace();
  const [selectedDate, setSelectedDate] = useState(() => workspace?.today || new Date().toISOString().slice(0, 10));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBlock, setEditingBlock] = useState<ScheduleBlock | null>(null);

  const [title, setTitle] = useState('');
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('09:30');
  const [priority, setPriority] = useState<ScheduleBlock['priority']>('high');
  const [color, setColor] = useState<ScheduleBlock['color']>('primary');

  React.useEffect(() => {
    if (workspace?.today && !selectedDate) {
      setSelectedDate(workspace.today);
    }
  }, [workspace?.today, selectedDate]);

  if (!workspace) {
    return (
      <AppShell title="Schedule">
        <div className="card-surface p-6 text-sm text-muted-foreground">Loading timeline...</div>
      </AppShell>
    );
  }

  const dayBlocks = workspace.scheduleBlocks
    .filter((b) => b.date === selectedDate)
    .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime) || a.sortOrder - b.sortOrder);

  const completedCount = dayBlocks.filter((b) => b.completed).length;

  const openCreate = () => {
    setEditingBlock(null);
    setTitle('');
    setStartTime('08:00');
    setEndTime('09:30');
    setPriority('high');
    setColor('primary');
    setDialogOpen(true);
  };

  const openEdit = (b: ScheduleBlock) => {
    setEditingBlock(b);
    setTitle(b.title);
    setStartTime(b.startTime);
    setEndTime(b.endTime);
    setPriority(b.priority);
    setColor(b.color);
    setDialogOpen(true);
  };

  const handleSaveBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    if (editingBlock) {
      await updateBlock(editingBlock.id, {
        title: title.trim(),
        startTime,
        endTime,
        priority,
        color,
      });
    } else {
      await createBlock({
        date: selectedDate,
        startTime,
        endTime,
        title: title.trim(),
        priority,
        color,
        completed: false,
        sortOrder: dayBlocks.length,
      });
    }
    setDialogOpen(false);
  };

  const handleToggleComplete = async (b: ScheduleBlock) => {
    if (!b.completed) {
      playTacticalChime('complete', workspace.user.soundEnabled, workspace.user.soundVolume);
      triggerHaptic(workspace.user.hapticsEnabled);
    }
    await updateBlock(b.id, { completed: !b.completed });
  };

  const handleSwapOrder = async (index: number, dir: -1 | 1) => {
    const targetIdx = index + dir;
    if (targetIdx < 0 || targetIdx >= dayBlocks.length) return;
    const a = dayBlocks[index];
    const b = dayBlocks[targetIdx];
    await Promise.all([
      updateBlock(a.id, { sortOrder: targetIdx, startTime: b.startTime, endTime: b.endTime }),
      updateBlock(b.id, { sortOrder: index, startTime: a.startTime, endTime: a.endTime }),
    ]);
  };

  return (
    <AppShell
      title="Schedule & Time Blocking"
      headerAction={
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" /> Add Block
        </Button>
      }
    >
      <PageHeading
        title="Time-Blocking Engine"
        subtitle={`${selectedDate} · ${completedCount}/${dayBlocks.length} blocks executed (+6 XP per block)`}
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setSelectedDate(shiftDateISO(selectedDate, -1))}>
              Prev
            </Button>
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
              className="w-36 h-9 num"
            />
            <Button variant="outline" size="sm" onClick={() => setSelectedDate(shiftDateISO(selectedDate, 1))}>
              Next
            </Button>
            {selectedDate !== workspace.today && (
              <Button variant="ghost" size="sm" onClick={() => setSelectedDate(workspace.today)}>
                Today
              </Button>
            )}
          </div>
        }
      />

      <Tabs defaultValue="timeline">
        <TabsList>
          <TabsTrigger value="timeline">Day Timeline</TabsTrigger>
          <TabsTrigger value="templates">Templates ({workspace.templates.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="timeline" className="space-y-4">
          {dayBlocks.length === 0 ? (
            <div className="card-surface p-8 text-center space-y-3">
              <Calendar className="h-8 w-8 mx-auto text-muted-foreground" />
              <h3 className="text-base font-semibold">No blocks scheduled for {selectedDate}</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Add custom time blocks or apply Monk Mode from the Templates tab to structure this day.
              </p>
              <div className="flex justify-center gap-2 pt-2">
                <Button onClick={openCreate}>Add Time Block</Button>
              </div>
            </div>
          ) : (
            <div className="card-surface divide-y divide-border/60">
              {dayBlocks.map((block, idx) => (
                <div
                  key={block.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-accent/25 transition-colors"
                >
                  <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                    <button
                      type="button"
                      onClick={() => handleToggleComplete(block)}
                      aria-label={block.completed ? 'Mark incomplete' : 'Mark complete'}
                      className={`mt-0.5 sm:mt-0 h-6 w-6 rounded-lg border flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                        block.completed
                          ? 'bg-success border-success text-background'
                          : 'border-border bg-surface text-transparent hover:border-primary'
                      }`}
                    >
                      <Check className="h-3.5 w-3.5 stroke-[2.5]" />
                    </button>

                    <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${COLOR_DOT[block.color]}`} />

                    <div className="min-w-0 space-y-0.5">
                      <p className={`text-sm font-semibold truncate ${block.completed ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                        {block.title}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span className="num text-foreground/90">
                          {block.startTime} – {block.endTime}
                        </span>
                        <span>·</span>
                        <span className="num">{durationLabel(block.startTime, block.endTime)}</span>
                        <span>·</span>
                        <span className={`capitalize font-medium ${PRIORITY_TEXT[block.priority]}`}>
                          {block.priority} priority
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 self-end sm:self-center shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      disabled={idx === 0}
                      onClick={() => handleSwapOrder(idx, -1)}
                      aria-label="Move block earlier"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      disabled={idx === dayBlocks.length - 1}
                      onClick={() => handleSwapOrder(idx, 1)}
                      aria-label="Move block later"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => openEdit(block)}
                      aria-label="Edit block"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => deleteBlock(block.id)}
                      aria-label="Delete block"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Quick 24h Coverage Summary */}
          <div className="card-surface p-4">
            <SectionHeader
              title="24-Hour Density Overview"
              subtitle="Scheduled coverage across the 00:00–24:00 tactical window"
            />
            <div className="mt-3 h-4 w-full rounded-full bg-surface relative overflow-hidden">
              {dayBlocks.map((b) => {
                const startPct = (timeToMinutes(b.startTime) / 1440) * 100;
                const widthPct = Math.max(1.5, ((timeToMinutes(b.endTime) - timeToMinutes(b.startTime)) / 1440) * 100);
                return (
                  <div
                    key={b.id}
                    title={`${b.startTime}–${b.endTime} ${b.title}`}
                    className={`absolute top-0 bottom-0 ${b.completed ? 'bg-success' : COLOR_DOT[b.color]} opacity-85 border-r border-background`}
                    style={{ left: `${startPct}%`, width: `${widthPct}%` }}
                  />
                );
              })}
            </div>
            <div className="mt-1.5 flex justify-between text-[11px] num text-muted-foreground">
              <span>00:00</span>
              <span>06:00</span>
              <span>12:00</span>
              <span>18:00</span>
              <span>24:00</span>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="templates">
          <CustomTemplates selectedDate={selectedDate} />
        </TabsContent>
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingBlock ? 'Edit Time Block' : 'Add Time Block'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveBlock} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Mission / Block Title</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Deep Work Block I"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Start Time</label>
                <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="num" required />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">End Time</label>
                <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="num" required />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Priority Tier</label>
                <Select value={priority} onValueChange={(v) => setPriority(v as ScheduleBlock['priority'])}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Semantic Color</label>
                <Select value={color} onValueChange={(v) => setColor(v as ScheduleBlock['color'])}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="primary">Violet (Deep Work)</SelectItem>
                    <SelectItem value="secondary">Cyan (Systems / Health)</SelectItem>
                    <SelectItem value="success">Emerald (Training)</SelectItem>
                    <SelectItem value="warning">Amber (Learning)</SelectItem>
                    <SelectItem value="destructive">Crimson (Critical)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">{editingBlock ? 'Update Block' : 'Create Block'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
