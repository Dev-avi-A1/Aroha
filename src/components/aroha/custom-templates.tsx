import React, { useState } from 'react';
import { Copy, Edit3, Layers, Plus, Trash2 } from 'lucide-react';
import { useWorkspace, type ScheduleTemplate } from '@/context/WorkspaceContext';
import type { TemplateBlockItem } from '@/lib/presets';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
              <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/60">
                <Button
                  size="sm"
                  onClick={() => applyTemplate(selectedDate, tpl.id, true)}
                >
                  Apply to {selectedDate}
                </Button>
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
    </div>
  );
}
