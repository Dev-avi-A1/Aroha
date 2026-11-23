import React, { useState } from 'react';
import { NotebookPen, Search, Trash2 } from 'lucide-react';
import { useWorkspace, type JournalEntry } from '@/context/WorkspaceContext';
import { AppShell } from '@/components/aroha/app-shell';
import { PageHeading, SectionHeader } from '@/components/aroha/primitives';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

const MOODS: JournalEntry['mood'][] = ['Focused', 'Calm', 'Tired', 'Driven'];

const MOOD_CLASS: Record<JournalEntry['mood'], string> = {
  Focused: 'text-primary',
  Calm: 'text-secondary',
  Tired: 'text-warning',
  Driven: 'text-success',
};

export function JournalPage() {
  const { workspace, createJournal, deleteJournal } = useWorkspace();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [mood, setMood] = useState<JournalEntry['mood']>('Focused');
  const [search, setSearch] = useState('');
  const [moodFilter, setMoodFilter] = useState<'All' | JournalEntry['mood']>('All');
  const [submitting, setSubmitting] = useState(false);

  if (!workspace) {
    return (
      <AppShell title="Journal">
        <div className="card-surface p-6 text-sm text-muted-foreground">Loading archives...</div>
      </AppShell>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    setSubmitting(true);
    try {
      await createJournal({
        date: workspace.today,
        title: title.trim(),
        content: content.trim(),
        mood,
      });
      setTitle('');
      setContent('');
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = workspace.journalEntries.filter((entry) => {
    const matchesMood = moodFilter === 'All' || entry.mood === moodFilter;
    const q = search.trim().toLowerCase();
    const matchesQuery =
      !q || entry.title.toLowerCase().includes(q) || entry.content.toLowerCase().includes(q);
    return matchesMood && matchesQuery;
  });

  return (
    <AppShell title="Mental Journal">
      <PageHeading
        title="Mental Journal & Daily Reflection"
        subtitle="Audit internal state and friction points (+15 XP per journal day)"
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Editor */}
        <form onSubmit={handleSubmit} className="lg:col-span-5 card-surface p-6 space-y-4 h-fit">
          <SectionHeader title="New Reflection" subtitle={workspace.today} />

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Cognitive State</label>
            <div className="grid grid-cols-2 gap-2">
              {MOODS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMood(m)}
                  className={`rounded-xl border px-3 py-2 text-xs font-medium transition-colors cursor-pointer ${
                    mood === m
                      ? 'border-primary bg-primary-soft text-primary'
                      : 'border-border bg-surface text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Entry Title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Execution Audit & Resistance Check"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Reflection</label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="What advanced your discipline today? Where did friction appear?"
              className="min-h-[160px]"
              required
            />
          </div>

          <Button type="submit" disabled={submitting} className="w-full glow-primary">
            <NotebookPen className="h-4 w-4" />
            {submitting ? 'Logging...' : 'Log Reflection'}
          </Button>
        </form>

        {/* Historical Archives */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <Search className="h-4 w-4 text-muted-foreground absolute left-3.5 top-3" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search reflections..."
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-1 bg-surface border border-border rounded-xl p-1">
              {(['All', ...MOODS] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMoodFilter(m)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    moodFilter === m ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="card-surface p-8 text-center text-sm text-muted-foreground">
              No journal entries match your filter.
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((entry) => (
                <article key={entry.id} className="card-surface p-5 space-y-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold text-foreground">{entry.title}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        <span className="num">{entry.date}</span>
                        {' · '}
                        <span className={`font-medium ${MOOD_CLASS[entry.mood]}`}>{entry.mood}</span>
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() => deleteJournal(entry.id)}
                      aria-label="Delete journal entry"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                    {entry.content}
                  </p>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
