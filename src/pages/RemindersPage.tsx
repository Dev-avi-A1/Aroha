import React, { useState } from 'react';
import { Bell, Clock, Plus, Trash2, Volume2 } from 'lucide-react';
import { useWorkspace } from '@/context/WorkspaceContext';
import { AppShell } from '@/components/aroha/app-shell';
import { NotificationPermissionCard } from '@/components/aroha/notification-scheduler';
import { PageHeading, SectionHeader } from '@/components/aroha/primitives';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function RemindersPage() {
  const { workspace, updateProfile, createReminder, updateReminder, deleteReminder } = useWorkspace();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [time, setTime] = useState('07:30');
  const [days, setDays] = useState<string[]>(DAYS);
  const [voiceAlert, setVoiceAlert] = useState(false);

  if (!workspace) {
    return (
      <AppShell title="Reminders">
        <div className="card-surface p-6 text-sm text-muted-foreground">Loading reminders...</div>
      </AppShell>
    );
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    await createReminder({ title: title.trim(), time, days, voiceAlert });
    setTitle('');
    setDialogOpen(false);
  };

  const toggleDay = (d: string) => {
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  };

  return (
    <AppShell
      title="Reminders & Alerts"
      headerAction={
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" /> Add Reminder
        </Button>
      }
    >
      <PageHeading
        title="Reminders & Push Alerts"
        subtitle="Configurable block lead-times, Web Push triggers, and voice reminders"
      />

      <NotificationPermissionCard />

      <div className="card-surface p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Block Lead Time</p>
            <p className="text-xs text-muted-foreground">Alert before scheduled block start</p>
          </div>
          <Select
            value={String(workspace.user.leadTimeMinutes)}
            onValueChange={(v) => updateProfile({ leadTimeMinutes: Number.parseInt(v, 10) })}
          >
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="5">5 min</SelectItem>
              <SelectItem value="10">10 min</SelectItem>
              <SelectItem value="15">15 min</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Text-to-Speech Voice Cues</p>
            <p className="text-xs text-muted-foreground">Spoken alert announcements</p>
          </div>
          <Switch
            checked={workspace.user.voiceRemindersEnabled}
            onCheckedChange={(checked) => updateProfile({ voiceRemindersEnabled: checked })}
          />
        </div>
      </div>

      <div className="card-surface p-5 space-y-4">
        <SectionHeader title="Custom Protocol Reminders" subtitle="Recurring daily or weekday triggers" />
        {workspace.reminders.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">No custom reminders configured.</p>
        ) : (
          <div className="divide-y divide-border/60">
            {workspace.reminders.map((rem) => {
              let remDays: string[] = [];
              try {
                remDays = JSON.parse(rem.daysJson) as string[];
              } catch {
                remDays = DAYS;
              }
              return (
                <div key={rem.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Bell className="h-4 w-4 text-primary shrink-0" />
                      <span className="text-sm font-semibold truncate">{rem.title}</span>
                      {rem.voiceAlert && <Volume2 className="h-3.5 w-3.5 text-secondary shrink-0" />}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      <span className="num text-foreground font-medium">{rem.time}</span> · {remDays.join(', ')}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        updateReminder(rem.id, {
                          snoozedUntil: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
                        })
                      }
                    >
                      <Clock className="h-3.5 w-3.5" /> Snooze 10m
                    </Button>
                    <Switch
                      checked={rem.enabled}
                      onCheckedChange={(checked) => updateReminder(rem.id, { enabled: checked })}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => deleteReminder(rem.id)}
                      aria-label="Delete reminder"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule Reminder</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Reminder Title</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Hydrate & Posture Check"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Time</label>
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="num" required />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Active Days</label>
              <div className="flex flex-wrap gap-1.5">
                {DAYS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => toggleDay(d)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border cursor-pointer ${
                      days.includes(d)
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-surface text-muted-foreground border-border'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Voice Announcement</span>
              <Switch checked={voiceAlert} onCheckedChange={setVoiceAlert} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit">Save Reminder</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
