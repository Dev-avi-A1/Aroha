import React, { useMemo, useState } from 'react';
import { CalendarRange, Copy, Edit3, Layers, Plus, Trash2, X } from 'lucide-react';
import { useWorkspace, type ScheduleTemplate } from '@/context/WorkspaceContext';
import { shiftDateISO, type TemplateBlockItem } from '@/lib/presets';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

const WEEKDAY_OPTIONS = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 0, label: 'Sun' },
] as const;

type SpanMode = '1w' | '2w' | '1m' | '3m' | 'custom' | 'specific';
type ConflictPolicy = 'replace' | 'skip' | 'append';

function getUtcDayOfWeek(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function MultiDateApplyDialog({
  open,
  onOpenChange,
  template,
  defaultStartDate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: ScheduleTemplate | null;
  defaultStartDate: string;
}) {
  const { applyTemplateBatch } = useWorkspace();
  const [spanMode, setSpanMode] = useState<SpanMode>('1w');
  const [startDate, setStartDate] = useState(defaultStartDate);
  const [endDate, setEndDate] = useState(() => shiftDateISO(defaultStartDate, 6));
  const [weekdays, setWeekdays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [specificDateInput, setSpecificDateInput] = useState(defaultStartDate);
  const [pickedDates, setPickedDates] = useState<string[]>([defaultStartDate]);
  const [conflictPolicy, setConflictPolicy] = useState<ConflictPolicy>('replace');
  const [submitting, setSubmitting] = useState(false);

  React.useEffect(() => {
    if (open) {
      setSpanMode('1w');
      setStartDate(defaultStartDate);
      setEndDate(shiftDateISO(defaultStartDate, 6));
      setWeekdays([0, 1, 2, 3, 4, 5, 6]);
      setSpecificDateInput(defaultStartDate);
      setPickedDates([defaultStartDate]);
      setConflictPolicy('replace');
    }
  }, [open, defaultStartDate]);

  const templateBlockCount = useMemo(() => {
    if (!template) return 0;
    try {
      return (JSON.parse(template.blocksJson) as unknown[]).length;
    } catch {
      return 0;
    }
  }, [template]);

  const selectSpanPreset = (mode: SpanMode) => {
    setSpanMode(mode);
    if (mode === '1w') setEndDate(shiftDateISO(startDate, 6));
    else if (mode === '2w') setEndDate(shiftDateISO(startDate, 13));
    else if (mode === '1m') setEndDate(shiftDateISO(startDate, 29));
    else if (mode === '3m') setEndDate(shiftDateISO(startDate, 89));
  };

  const handleStartDateChange = (nextStart: string) => {
    if (!nextStart) return;
    setStartDate(nextStart);
    if (spanMode === '1w') setEndDate(shiftDateISO(nextStart, 6));
    else if (spanMode === '2w') setEndDate(shiftDateISO(nextStart, 13));
    else if (spanMode === '1m') setEndDate(shiftDateISO(nextStart, 29));
    else if (spanMode === '3m') setEndDate(shiftDateISO(nextStart, 89));
    else if (nextStart > endDate) setEndDate(nextStart);
  };

  const toggleWeekday = (dow: number) => {
    setWeekdays((prev) =>
      prev.includes(dow) ? prev.filter((d) => d !== dow) : [...prev, dow]
    );
  };

  const handleAddPickedDate = () => {
    if (!specificDateInput) return;
    setPickedDates((prev) => {
      if (prev.includes(specificDateInput) || prev.length >= 100) return prev;
      return [...prev, specificDateInput].sort();
    });
  };

  const { previewDates, rangeError } = useMemo(() => {
    if (spanMode === 'specific') {
      return { previewDates: [...pickedDates].sort(), rangeError: null as string | null };
    }
    if (!startDate || !endDate) {
      return { previewDates: [] as string[], rangeError: 'Select both a start and end date.' };
    }
    if (startDate > endDate) {
      return { previewDates: [] as string[], rangeError: 'Start date must be on or before end date.' };
    }
    const allowed = new Set(weekdays);
    if (allowed.size === 0) {
      return { previewDates: [] as string[], rangeError: 'Select at least one weekday.' };
    }

    const matched: string[] = [];
    let cursor = startDate;
    let safetyDays = 0;
    while (cursor <= endDate && safetyDays < 105) {
      if (allowed.has(getUtcDayOfWeek(cursor))) {
        matched.push(cursor);
      }
      cursor = shiftDateISO(cursor, 1);
      safetyDays += 1;
    }

    if (safetyDays >= 105 && cursor <= endDate) {
      return {
        previewDates: matched,
        rangeError: 'Date span exceeds the 100-day limit per apply action.',
      };
    }
    if (matched.length > 100) {
      return {
        previewDates: matched,
        rangeError: 'Cannot apply to more than 100 days at once.',
      };
    }
    return { previewDates: matched, rangeError: null as string | null };
  }, [spanMode, startDate, endDate, weekdays, pickedDates]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!template || rangeError || previewDates.length === 0 || submitting) return;
    setSubmitting(true);
    try {
      await applyTemplateBatch({
        templateId: template.id,
        ...(spanMode === 'specific'
          ? { dates: previewDates }
          : { startDate, endDate, weekdays }),
        replaceExisting: conflictPolicy === 'replace',
        skipPopulatedDays: conflictPolicy === 'skip',
      });
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  const firstPreview = previewDates[0];
  const lastPreview = previewDates[previewDates.length - 1];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarRange className="h-4 w-4 text-primary" />
            Multi-Date Template Deployment
          </DialogTitle>
          <DialogDescription>
            Deploy <span className="font-medium text-foreground">{template?.name}</span> ({templateBlockCount} blocks/day) across weeks, 1 month, 3 months, or custom dates.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="max-h-[65vh] overflow-y-auto pr-1 space-y-4">
            {/* Horizon Presets */}
            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-[0.1em] text-muted-foreground">
                Horizon / Date Mode
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: '1w', label: '1 Week (7d)' },
                  { id: '2w', label: '2 Weeks (14d)' },
                  { id: '1m', label: '1 Month (30d)' },
                  { id: '3m', label: '3 Months (90d)' },
                  { id: 'custom', label: 'Custom Range' },
                  { id: 'specific', label: 'Pick Dates' },
                ].map((opt) => {
                  const active = spanMode === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => selectSpanPreset(opt.id as SpanMode)}
                      className={`px-2.5 py-2 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                        active
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-surface border-border text-muted-foreground hover:text-foreground hover:border-primary/50'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {spanMode === 'specific' ? (
              <div className="space-y-2.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Select Individual Dates ({pickedDates.length}/100)
                </label>
                <div className="flex items-center gap-2">
                  <Input
                    type="date"
                    value={specificDateInput}
                    onChange={(e) => setSpecificDateInput(e.target.value)}
                    className="num"
                  />
                  <Button type="button" variant="outline" onClick={handleAddPickedDate}>
                    <Plus className="h-4 w-4" /> Add Date
                  </Button>
                </div>
                {pickedDates.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {pickedDates.map((d) => (
                      <span
                        key={d}
                        className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1 text-xs num text-foreground"
                      >
                        {d}
                        <button
                          type="button"
                          onClick={() => setPickedDates((prev) => prev.filter((item) => item !== d))}
                          className="text-muted-foreground hover:text-destructive cursor-pointer"
                          aria-label={`Remove ${d}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Add one or more dates above.</p>
                )}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Start Date</label>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => handleStartDateChange(e.target.value)}
                      className="num"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">End Date</label>
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => {
                        setSpanMode('custom');
                        if (e.target.value) setEndDate(e.target.value);
                      }}
                      className="num"
                      required
                    />
                  </div>
                </div>

                {/* Weekday Filter */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-xs font-medium uppercase tracking-[0.1em] text-muted-foreground">
                      Active Weekdays
                    </label>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setWeekdays([0, 1, 2, 3, 4, 5, 6])}
                        className="text-[11px] text-primary hover:underline cursor-pointer"
                      >
                        Every Day
                      </button>
                      <span className="text-border">·</span>
                      <button
                        type="button"
                        onClick={() => setWeekdays([1, 2, 3, 4, 5])}
                        className="text-[11px] text-primary hover:underline cursor-pointer"
                      >
                        Weekdays
                      </button>
                      <span className="text-border">·</span>
                      <button
                        type="button"
                        onClick={() => setWeekdays([0, 6])}
                        className="text-[11px] text-primary hover:underline cursor-pointer"
                      >
                        Weekends
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-7 gap-1.5">
                    {WEEKDAY_OPTIONS.map((day) => {
                      const active = weekdays.includes(day.value);
                      return (
                        <button
                          key={day.value}
                          type="button"
                          onClick={() => toggleWeekday(day.value)}
                          className={`py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                            active
                              ? 'bg-primary/20 border-primary text-foreground'
                              : 'bg-surface border-border text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          {day.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {/* Conflict Policy */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium uppercase tracking-[0.1em] text-muted-foreground">
                Existing Blocks Behavior
              </label>
              <Select
                value={conflictPolicy}
                onValueChange={(v) => setConflictPolicy(v as ConflictPolicy)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="replace">Replace existing blocks on these days</SelectItem>
                  <SelectItem value="skip">Skip days that already have blocks</SelectItem>
                  <SelectItem value="append">Append blocks alongside existing schedule</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Deployment Preview */}
            <div className="rounded-xl border border-border bg-surface p-3 space-y-1">
              {rangeError ? (
                <p className="text-xs font-medium text-destructive">{rangeError}</p>
              ) : (
                <>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Target Deployment</span>
                    <span className="num font-semibold text-foreground">
                      {previewDates.length} day{previewDates.length === 1 ? '' : 's'} ·{' '}
                      {previewDates.length * templateBlockCount} blocks
                    </span>
                  </div>
                  {firstPreview && lastPreview && (
                    <p className="text-[11px] text-muted-foreground num">
                      {firstPreview === lastPreview
                        ? `Date: ${firstPreview}`
                        : `Span: ${firstPreview} → ${lastPreview}`}
                    </p>
                  )}
                </>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting || Boolean(rangeError) || previewDates.length === 0}
            >
              {submitting
                ? 'Deploying...'
                : `Apply to ${previewDates.length} Day${previewDates.length === 1 ? '' : 's'}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function TemplateEditorSheet({
  open,
  onOpenChange,
  initialTemplate,
  seedBlocks,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTemplate?: ScheduleTemplate | null;
  seedBlocks?: TemplateBlockItem[];
}) {
  const { saveTemplate } = useWorkspace();
  const parsedExisting: TemplateBlockItem[] = initialTemplate
    ? (() => {
        try {
          return JSON.parse(initialTemplate.blocksJson) as TemplateBlockItem[];
        } catch {
          return [];
        }
      })()
    : seedBlocks && seedBlocks.length > 0
      ? seedBlocks
      : [{ startTime: '06:00', endTime: '08:00', title: 'Deep Work Block', priority: 'high', color: 'primary' }];

  const [name, setName] = useState(initialTemplate?.name ?? '');
  const [description, setDescription] = useState(initialTemplate?.description ?? '');
  const [blocks, setBlocks] = useState<TemplateBlockItem[]>(parsedExisting);
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (open) {
      setName(initialTemplate?.name ?? '');
      setDescription(initialTemplate?.description ?? '');
      if (initialTemplate) {
        try {
          setBlocks(JSON.parse(initialTemplate.blocksJson) as TemplateBlockItem[]);
        } catch {
          setBlocks([]);
        }
      } else if (seedBlocks && seedBlocks.length > 0) {
        setBlocks(seedBlocks);
      } else {
        setBlocks([
          { startTime: '06:00', endTime: '08:00', title: 'Deep Work Block', priority: 'high', color: 'primary' },
        ]);
      }
    }
  }, [open, initialTemplate, seedBlocks]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || blocks.length === 0) return;
    setSaving(true);
    try {
      await saveTemplate({
        id: initialTemplate?.id,
        name: name.trim(),
        description: description.trim(),
        blocks,
      });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const updateBlockAt = (idx: number, patch: Partial<TemplateBlockItem>) => {
    setBlocks((prev) => prev.map((b, i) => (i === idx ? { ...b, ...patch } : b)));
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-lg bg-surface border-border">
        <SheetHeader className="pb-4 border-b border-border">
          <SheetTitle>{initialTemplate ? 'Edit Schedule Template' : 'New Schedule Template'}</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSave} className="mt-5 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Template Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Sovereign Deep Work"
              required
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Protocol Summary</label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Concise operational objective"
            />
          </div>

          <div className="space-y-2.5 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-[0.1em] text-muted-foreground">
                Time Blocks ({blocks.length})
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setBlocks((prev) => [
                    ...prev,
                    { startTime: '09:00', endTime: '10:30', title: 'Focused Execution', priority: 'medium', color: 'primary' },
                  ])
                }
              >
                <Plus className="h-3.5 w-3.5" /> Add Block
              </Button>
            </div>

            <div className="space-y-3 max-h-[45vh] overflow-y-auto pr-1">
              {blocks.map((block, idx) => (
                <div key={idx} className="rounded-xl border border-border bg-card p-3 space-y-2.5">
                  <div className="flex items-center gap-2">
                    <Input
                      value={block.title}
                      onChange={(e) => updateBlockAt(idx, { title: e.target.value })}
                      placeholder="Block title"
                      required
                    />
                    {blocks.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setBlocks((prev) => prev.filter((_, i) => i !== idx))}
                        aria-label="Remove block"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <Input
                      type="time"
                      value={block.startTime}
                      onChange={(e) => updateBlockAt(idx, { startTime: e.target.value })}
                      className="num"
                    />
                    <Input
                      type="time"
                      value={block.endTime}
                      onChange={(e) => updateBlockAt(idx, { endTime: e.target.value })}
                      className="num"
                    />
                    <Select
                      value={block.priority}
                      onValueChange={(val) =>
                        updateBlockAt(idx, { priority: val as TemplateBlockItem['priority'] })
                      }
                    >
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
                </div>
              ))}
            </div>
          </div>

          <div className="pt-3 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Save Template'}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

export function CustomTemplates({ selectedDate }: { selectedDate: string }) {
  const { workspace, applyTemplate, saveTemplate, deleteTemplate } = useWorkspace();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ScheduleTemplate | null>(null);
  const [seedBlocks, setSeedBlocks] = useState<TemplateBlockItem[] | undefined>(undefined);
  const [multiDateOpen, setMultiDateOpen] = useState(false);
  const [multiDateTemplate, setMultiDateTemplate] = useState<ScheduleTemplate | null>(null);

  if (!workspace) return null;

  const dayBlocksForSeed: TemplateBlockItem[] = workspace.scheduleBlocks
    .filter((b) => b.date === selectedDate)
    .map((b) => ({
      startTime: b.startTime,
      endTime: b.endTime,
      title: b.title,
      priority: b.priority,
      color: b.color,
    }));

  const handleDuplicate = async (tpl: ScheduleTemplate) => {
    let parsed: TemplateBlockItem[] = [];
    try {
      parsed = JSON.parse(tpl.blocksJson) as TemplateBlockItem[];
    } catch {
      parsed = [];
    }
    await saveTemplate({
      name: `${tpl.name} Copy`,
      description: tpl.description,
      blocks: parsed,
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-primary" />
          <h3 className="text-base font-semibold">Schedule Presets & Templates</h3>
        </div>
        <div className="flex items-center gap-2">
          {dayBlocksForSeed.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEditingTemplate(null);
                setSeedBlocks(dayBlocksForSeed);
                setEditorOpen(true);
              }}
            >
              Save Day as Template
            </Button>
          )}
          <Button
            size="sm"
            onClick={() => {
              setEditingTemplate(null);
              setSeedBlocks(undefined);
              setEditorOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> New Template
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {workspace.templates.map((tpl) => {
          let count = 0;
          try {
            count = (JSON.parse(tpl.blocksJson) as unknown[]).length;
          } catch {
            count = 0;
          }
          return (
            <div key={tpl.id} className="card-surface p-4 flex flex-col justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-sm font-semibold text-foreground">{tpl.name}</h4>
                  <span className="num text-xs text-muted-foreground">{count} blocks</span>
                </div>
                {tpl.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{tpl.description}</p>
                )}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/60">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Button
                    size="sm"
                    onClick={() => applyTemplate(selectedDate, tpl.id, true)}
                  >
                    Apply to {selectedDate}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setMultiDateTemplate(tpl);
                      setMultiDateOpen(true);
                    }}
                  >
                    <CalendarRange className="h-3.5 w-3.5" /> Multi-Date
                  </Button>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => {
                      setEditingTemplate(tpl);
                      setSeedBlocks(undefined);
                      setEditorOpen(true);
                    }}
                    aria-label="Edit template"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleDuplicate(tpl)}
                    aria-label="Duplicate template"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  {!tpl.isPreset && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Delete template">
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete template &ldquo;{tpl.name}&rdquo;?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This removes the custom preset permanently. Existing scheduled blocks on your calendar remain intact.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteTemplate(tpl.id)}>
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <TemplateEditorSheet
        open={editorOpen}
        onOpenChange={setEditorOpen}
        initialTemplate={editingTemplate}
        seedBlocks={seedBlocks}
      />

      <MultiDateApplyDialog
        open={multiDateOpen}
        onOpenChange={setMultiDateOpen}
        template={multiDateTemplate}
        defaultStartDate={selectedDate}
      />
    </div>
  );
}
