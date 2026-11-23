import React, { useEffect, useRef, useState } from 'react';
import { Bot, Send, Trash2 } from 'lucide-react';
import { useWorkspace } from '@/context/WorkspaceContext';
import { AppShell } from '@/components/aroha/app-shell';
import { PageHeading } from '@/components/aroha/primitives';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

const QUICK_PROMPTS = [
  'Audit my discipline score and schedule gaps today.',
  'Identify my biggest execution leak based on my habits and sleep.',
  'Design an uncompromising focus plan for my remaining blocks.',
];

export function CoachPage() {
  const { workspace, sendCoachMessage, clearCoachHistory } = useWorkspace();
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [workspace?.coachMessages.length]);

  if (!workspace) {
    return (
      <AppShell title="AROHA AI">
        <div className="card-surface p-6 text-sm text-muted-foreground">Initializing coach...</div>
      </AppShell>
    );
  }

  const todayBlocks = workspace.scheduleBlocks.filter((b) => b.date === workspace.today);
  const completedBlocks = todayBlocks.filter((b) => b.completed).length;
  const todayCheckins = workspace.habitCheckins.filter((c) => c.date === workspace.today).length;
  const habitRate = workspace.habits.length > 0 ? Math.round((todayCheckins / workspace.habits.length) * 100) : 0;

  const handleSend = async (textToSend?: string) => {
    const msg = (textToSend ?? input).trim();
    if (!msg || sending) return;
    setSending(true);
    if (!textToSend) setInput('');
    try {
      await sendCoachMessage(msg);
    } finally {
      setSending(false);
    }
  };

  return (
    <AppShell
      title="AROHA AI Coach"
      headerAction={
        <Button variant="ghost" size="sm" onClick={() => clearCoachHistory()}>
          <Trash2 className="h-3.5 w-3.5" /> Clear
        </Button>
      }
    >
      <PageHeading
        title="AROHA AI Coach"
        subtitle="Analytical, stoic tactical coaching grounded in your live PostgreSQL telemetry"
      />

      {/* Live Context Grounding Strip */}
      <div className="card-surface p-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
        <span>
          Discipline: <strong className="num text-primary">{workspace.disciplineScore}/100</strong>
        </span>
        <span>
          Blocks: <strong className="num text-foreground">{completedBlocks}/{todayBlocks.length}</strong>
        </span>
        <span>
          Habit Rate: <strong className="num text-success">{habitRate}%</strong>
        </span>
        <span>
          Mood: <strong className="text-foreground">{workspace.journalEntries[0]?.mood ?? 'Unlogged'}</strong>
        </span>
        <span>
          Rank: <strong className="text-warning">{workspace.xp.rank} Lv.{workspace.xp.level}</strong>
        </span>
      </div>

      {/* Chat Stream */}
      <div className="card-surface flex flex-col h-[60vh] min-h-[420px]">
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {workspace.coachMessages.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <Bot className="h-8 w-8 mx-auto text-primary" />
              <p className="text-sm text-muted-foreground">
                AROHA AI is ready. Ask for a tactical audit of your day.
              </p>
            </div>
          ) : (
            workspace.coachMessages.map((m) => (
              <div
                key={m.id}
                className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                    m.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-surface border border-border text-foreground'
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))
          )}
          {sending && (
            <div className="flex justify-start">
              <div className="bg-surface border border-border rounded-2xl px-4 py-3 text-xs text-muted-foreground">
                Analyzing operator telemetry...
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="border-t border-border p-4 space-y-3 bg-surface/50 rounded-b-[22px]">
          <div className="flex flex-wrap gap-2">
            {QUICK_PROMPTS.map((q) => (
              <button
                key={q}
                type="button"
                disabled={sending}
                onClick={() => handleSend(q)}
                className="text-xs rounded-lg border border-border bg-card px-2.5 py-1.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer"
              >
                {q}
              </button>
            ))}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-end gap-2.5"
          >
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Report status or ask AROHA AI for a tactical adjustment..."
              className="min-h-[52px] max-h-32 resize-none"
            />
            <Button type="submit" disabled={sending || !input.trim()} className="h-[52px] px-5 shrink-0 glow-primary">
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>
    </AppShell>
  );
}
