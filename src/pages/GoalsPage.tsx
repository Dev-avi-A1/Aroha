import React, { useState } from 'react';
import { CheckCircle2, Plus, Target, Trash2 } from 'lucide-react';
import { useWorkspace, type GoalItem, type GoalMilestone } from '@/context/WorkspaceContext';
import { playTacticalChime, triggerHaptic } from '@/lib/audio';
import { AppShell } from '@/components/aroha/app-shell';
import { Meter, PageHeading } from '@/components/aroha/primitives';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

const CATEGORIES: GoalItem['category'][] = ['Discipline', 'Physical', 'Intellectual', 'Financial'];

export function GoalsPage() {
  const { workspace, createGoal, updateGoal, deleteGoal } = useWorkspace();
  const [catFilter, setCatFilter] = useState<'All' | GoalItem['category']>('All');
  const [dialogOpen, setDialogOpen] = useState(false);

  const [category, setCategory] = useState<GoalItem['category']>('Discipline');
  const [title, setTitle] = useState('');
  const [deadline, setDeadline] = useState('');
  const [milestonesText, setMilestonesText] = useState('Define execution checklist\nReview weekly progress');

  if (!workspace) {
    return (
      <AppShell title="Goals">
        <div className="card-surface p-6 text-sm text-muted-foreground">Loading goals...</div>
      </AppShell>
    );
  }

  const filtered =
    catFilter === 'All' ? workspace.goals : workspace.goals.filter((g) => g.category === catFilter);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const milestones: GoalMilestone[] = milestonesText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line, i) => ({ id: `${Date.now()}-${i}`, title: line, done: false }));

    await createGoal({
      category,
      title: title.trim(),
      deadline,
      milestones,
    });
    setTitle('');
    setDeadline('');
    setDialogOpen(false);
  };

  const toggleMilestone = async (goal: GoalItem, milestoneId: string) => {
    let list: GoalMilestone[] = [];
    try {
      list = JSON.parse(goal.milestonesJson) as GoalMilestone[];
    } catch {
      list = [];
    }
    const nextList = list.map((m) => (m.id === milestoneId ? { ...m, done: !m.done } : m));
    const allDone = nextList.length > 0 && nextList.every((m) => m.done);
    if (allDone && !goal.completed) {
      playTacticalChime('complete', workspace.user.soundEnabled, workspace.user.soundVolume);
      triggerHaptic(workspace.user.hapticsEnabled);
    }
    await updateGoal(goal.id, { milestones: nextList, completed: allDone || goal.completed });
  };

  return (
    <AppShell
      title="Goals & Vision"
      headerAction={
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" /> New Goal
        </Button>
      }
    >
      <PageHeading
        title="Goals & Vision Alignment"
        subtitle="Categorized strategic objectives and milestone checklists (+50 XP on completion)"
      />

      <Tabs value={catFilter} onValueChange={(v) => setCatFilter(v as typeof catFilter)}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="All">All ({workspace.goals.length})</TabsTrigger>
          {CATEGORIES.map((c) => (
            <TabsTrigger key={c} value={c}>
              {c}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {filtered.length === 0 ? (
        <div className="card-surface p-8 text-center space-y-3">
          <Target className="h-8 w-8 mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No goals in this category yet.</p>
          <Button onClick={() => setDialogOpen(true)}>Create Objective</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((goal) => {
            let milestones: GoalMilestone[] = [];
            try {
              milestones = JSON.parse(goal.milestonesJson) as GoalMilestone[];
            } catch {
              milestones = [];
            }
            const doneCount = milestones.filter((m) => m.done).length;
            const pct =
              goal.completed
                ? 100
                : milestones.length > 0
                  ? Math.round((doneCount / milestones.length) * 100)
                  : 0;

            return (
              <div key={goal.id} className="card-surface p-5 flex flex-col justify-between gap-4">
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs text-primary font-medium">
                        {goal.category}
                        {goal.deadline ? ` · Target ${goal.deadline}` : ''}
                      </p>
                      <h3 className={`text-base font-semibold mt-0.5 ${goal.completed ? 'text-success' : ''}`}>
                        {goal.title}
                      </h3>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() => deleteGoal(goal.id)}
                      aria-label="Delete goal"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Milestone Progress</span>
                      <span className="num">{pct}%</span>
                    </div>
                    <Meter value={pct} tone={goal.completed ? 'success' : 'primary'} />
                  </div>

                  {milestones.length > 0 && (
                    <div className="space-y-2 pt-1">
                      {milestones.map((m) => (
                        <label
                          key={m.id}
                          className="flex items-center gap-2.5 text-sm cursor-pointer hover:text-foreground"
                        >
                          <Checkbox checked={m.done} onCheckedChange={() => toggleMilestone(goal, m.id)} />
                          <span className={m.done ? 'line-through text-muted-foreground' : 'text-foreground'}>
                            {m.title}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-border/60 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {goal.completed ? 'Completed (+50 XP)' : 'In Progress'}
                  </span>
                  <Button
                    size="sm"
                    variant={goal.completed ? 'outline' : 'default'}
                    onClick={() => updateGoal(goal.id, { completed: !goal.completed })}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {goal.completed ? 'Reopen' : 'Mark Complete'}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Initialize Strategic Goal</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Category</label>
                <Select value={category} onValueChange={(v) => setCategory(v as GoalItem['category'])}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Deadline</label>
                <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="num" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Goal Title</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Ship Full-Stack Systems Architecture"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Milestones (one per line)</label>
              <textarea
                value={milestonesText}
                onChange={(e) => setMilestonesText(e.target.value)}
                className="flex min-h-[100px] w-full rounded-xl border border-input bg-surface px-3.5 py-2.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Create Goal</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
