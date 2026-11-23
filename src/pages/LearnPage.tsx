import React, { useState } from 'react';
import { BookOpen, Layers, Plus, RotateCw, Trash2 } from 'lucide-react';
import { useWorkspace, type LearningLog } from '@/context/WorkspaceContext';
import { AppShell } from '@/components/aroha/app-shell';
import { Meter, PageHeading, StatTile } from '@/components/aroha/primitives';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';

export function LearnPage() {
  const {
    workspace,
    createLearningLog,
    updateLearningLog,
    deleteLearningLog,
    createFlashcard,
    updateFlashcard,
    deleteFlashcard,
  } = useWorkspace();

  const [logDialogOpen, setLogDialogOpen] = useState(false);
  const [cardDialogOpen, setCardDialogOpen] = useState(false);
  const [activeCardIdx, setActiveCardIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);

  const [kind, setKind] = useState<LearningLog['kind']>('book');
  const [title, setTitle] = useState('');
  const [progressCurrent, setProgressCurrent] = useState('0');
  const [progressTotal, setProgressTotal] = useState('200');
  const [unit, setUnit] = useState('pages');
  const [minutesSpent, setMinutesSpent] = useState('30');

  const [deck, setDeck] = useState('Stoic Strategy');
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');

  if (!workspace) {
    return (
      <AppShell title="Learn">
        <div className="card-surface p-6 text-sm text-muted-foreground">Loading knowledge tracker...</div>
      </AppShell>
    );
  }

  const totalMinutes = workspace.learningLogs.reduce((s, l) => s + l.minutesSpent, 0);
  const masteredCards = workspace.flashcards.filter((c) => c.mastered).length;
  const currentCard = workspace.flashcards[activeCardIdx % Math.max(1, workspace.flashcards.length)];

  const handleAddLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    await createLearningLog({
      kind,
      title: title.trim(),
      progressCurrent: Number.parseInt(progressCurrent, 10) || 0,
      progressTotal: Math.max(1, Number.parseInt(progressTotal, 10) || 100),
      unit: unit.trim() || 'pages',
      minutesSpent: Number.parseInt(minutesSpent, 10) || 0,
      date: workspace.today,
    });
    setTitle('');
    setLogDialogOpen(false);
  };

  const handleAddCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!front.trim() || !back.trim()) return;
    await createFlashcard({ deck: deck.trim() || 'General', front: front.trim(), back: back.trim() });
    setFront('');
    setBack('');
    setCardDialogOpen(false);
  };

  return (
    <AppShell title="Knowledge & Learning">
      <PageHeading
        title="Knowledge & Learning Tracker"
        subtitle="Reading velocity, course milestones, and active-recall flashcard decks"
      />

      <div className="grid grid-cols-3 gap-3">
        <StatTile label="Study Minutes" value={totalMinutes} suffix="m" tone="primary" icon={BookOpen} />
        <StatTile label="Active Sources" value={workspace.learningLogs.length} tone="default" />
        <StatTile
          label="Cards Mastered"
          value={`${masteredCards}/${workspace.flashcards.length}`}
          tone="success"
          icon={Layers}
        />
      </div>

      <Tabs defaultValue="reading">
        <TabsList>
          <TabsTrigger value="reading">Reading & Courses</TabsTrigger>
          <TabsTrigger value="flashcards">Flashcards ({workspace.flashcards.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="reading" className="space-y-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setLogDialogOpen(true)}>
              <Plus className="h-4 w-4" /> Add Source
            </Button>
          </div>

          {workspace.learningLogs.length === 0 ? (
            <div className="card-surface p-8 text-center text-sm text-muted-foreground">
              No books or courses logged yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {workspace.learningLogs.map((log) => {
                const pct = Math.min(100, Math.round((log.progressCurrent / Math.max(1, log.progressTotal)) * 100));
                return (
                  <div key={log.id} className="card-surface p-5 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs text-primary capitalize font-medium">
                          {log.kind} · <span className="num">{log.minutesSpent}m</span> logged
                        </p>
                        <h3 className="text-base font-semibold mt-0.5">{log.title}</h3>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => deleteLearningLog(log.id)}
                        aria-label="Delete learning log"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>
                          <span className="num text-foreground">{log.progressCurrent}</span> /{' '}
                          <span className="num">{log.progressTotal}</span> {log.unit}
                        </span>
                        <span className="num">{pct}%</span>
                      </div>
                      <Meter value={pct} tone="warning" />
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          updateLearningLog(log.id, {
                            progressCurrent: Math.min(log.progressTotal, log.progressCurrent + 10),
                            minutesSpent: log.minutesSpent + 15,
                          })
                        }
                      >
                        +10 {log.unit} / +15m
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="flashcards" className="space-y-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setCardDialogOpen(true)}>
              <Plus className="h-4 w-4" /> New Flashcard
            </Button>
          </div>

          {workspace.flashcards.length === 0 ? (
            <div className="card-surface p-8 text-center text-sm text-muted-foreground">
              Create your first active-recall flashcard.
            </div>
          ) : (
            <div className="space-y-4">
              {currentCard && (
                <div className="card-surface p-6 sm:p-8 space-y-5 text-center">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Deck: {currentCard.deck}</span>
                    <span className="num">
                      Card {(activeCardIdx % workspace.flashcards.length) + 1} / {workspace.flashcards.length}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setFlipped(!flipped)}
                    className="w-full min-h-[140px] rounded-2xl border border-border bg-surface/70 p-6 flex flex-col items-center justify-center gap-3 hover:bg-accent/30 transition-colors cursor-pointer"
                  >
                    <span className="text-[11px] uppercase tracking-[0.14em] text-primary">
                      {flipped ? 'Answer' : 'Prompt (Click to Flip)'}
                    </span>
                    <p className="text-base sm:text-lg font-medium text-foreground max-w-xl leading-relaxed">
                      {flipped ? currentCard.back : currentCard.front}
                    </p>
                  </button>

                  <div className="flex flex-wrap items-center justify-center gap-2.5">
                    <Button variant="outline" size="sm" onClick={() => setFlipped(!flipped)}>
                      <RotateCw className="h-3.5 w-3.5" /> Flip
                    </Button>
                    <Button
                      size="sm"
                      variant={currentCard.mastered ? 'outline' : 'default'}
                      onClick={() =>
                        updateFlashcard(currentCard.id, {
                          mastered: !currentCard.mastered,
                          reviewCount: currentCard.reviewCount + 1,
                        })
                      }
                    >
                      {currentCard.mastered ? 'Mastered' : 'Mark Mastered'}
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setFlipped(false);
                        setActiveCardIdx((i) => (i + 1) % workspace.flashcards.length);
                      }}
                    >
                      Next Card
                    </Button>
                  </div>
                </div>
              )}

              <div className="card-surface divide-y divide-border/60">
                {workspace.flashcards.map((c, idx) => (
                  <div key={c.id} className="p-4 flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveCardIdx(idx);
                        setFlipped(false);
                      }}
                      className="text-left min-w-0 flex-1 cursor-pointer"
                    >
                      <p className="text-sm font-medium truncate">{c.front}</p>
                      <p className="text-xs text-muted-foreground">
                        {c.deck} · {c.mastered ? 'Mastered' : 'In Review'}
                      </p>
                    </button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() => deleteFlashcard(c.id)}
                      aria-label="Delete flashcard"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={logDialogOpen} onOpenChange={setLogDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log Book or Course</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddLog} className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Type</label>
                <Select value={kind} onValueChange={(v) => setKind(v as LearningLog['kind'])}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="book">Book</SelectItem>
                    <SelectItem value="course">Course</SelectItem>
                    <SelectItem value="lecture">Lecture</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Unit</label>
                <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="pages / modules" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Title</label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., The Art of War" required />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Current</label>
                <Input type="number" value={progressCurrent} onChange={(e) => setProgressCurrent(e.target.value)} className="num" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Total</label>
                <Input type="number" value={progressTotal} onChange={(e) => setProgressTotal(e.target.value)} className="num" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Minutes</label>
                <Input type="number" value={minutesSpent} onChange={(e) => setMinutesSpent(e.target.value)} className="num" />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setLogDialogOpen(false)}>Cancel</Button>
              <Button type="submit">Save Source</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={cardDialogOpen} onOpenChange={setCardDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Recall Flashcard</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddCard} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Deck Name</label>
              <Input value={deck} onChange={(e) => setDeck(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Prompt (Front)</label>
              <Textarea value={front} onChange={(e) => setFront(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Answer (Back)</label>
              <Textarea value={back} onChange={(e) => setBack(e.target.value)} required />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCardDialogOpen(false)}>Cancel</Button>
              <Button type="submit">Create Card</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
