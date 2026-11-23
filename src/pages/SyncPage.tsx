import React, { useState } from 'react';
import { Cloud, Download, RefreshCw, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { useWorkspace } from '@/context/WorkspaceContext';
import { AppShell } from '@/components/aroha/app-shell';
import { PageHeading, SectionHeader, StatTile } from '@/components/aroha/primitives';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

export function SyncPage() {
  const { workspace, lastSyncedAt, refreshWorkspace, apiFetch } = useWorkspace();
  const [importJson, setImportJson] = useState('');
  const [busy, setBusy] = useState(false);

  if (!workspace) {
    return (
      <AppShell title="Sync & Backup">
        <div className="card-surface p-6 text-sm text-muted-foreground">Loading sync state...</div>
      </AppShell>
    );
  }

  const handleExport = async () => {
    setBusy(true);
    try {
      const payload = await apiFetch('/api/sync/export');
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `aroha-backup-${workspace.today}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Structured JSON backup downloaded.');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Export failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importJson.trim()) return;
    setBusy(true);
    try {
      const parsed = JSON.parse(importJson);
      await apiFetch('/api/sync/import', {
        method: 'POST',
        body: JSON.stringify(parsed),
      });
      await refreshWorkspace();
      setImportJson('');
      toast.success('Backup imported and merged into Cloud SQL.');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Invalid JSON backup payload.');
    } finally {
      setBusy(false);
    }
  };

  const handleFilePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setImportJson(text);
  };

  return (
    <AppShell
      title="Cloud Sync & Backup"
      headerAction={
        <Button size="sm" variant="outline" onClick={() => refreshWorkspace()}>
          <RefreshCw className="h-3.5 w-3.5" /> Sync Now
        </Button>
      }
    >
      <PageHeading
        title="Cloud Sync & Offline Cache"
        subtitle="PostgreSQL primary storage with local offline snapshot and JSON export/import"
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatTile label="Cloud Records" value={workspace.scheduleBlocks.length + workspace.habits.length + workspace.journalEntries.length} tone="primary" icon={Cloud} />
        <StatTile label="Offline Snapshot" value={lastSyncedAt ? 'Cached' : 'Pending'} tone="success" />
        <StatTile label="Last Sync" value={lastSyncedAt ? lastSyncedAt.slice(11, 19) : '--:--'} tone="default" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="card-surface p-6 space-y-4">
          <SectionHeader title="Export Structured Backup" subtitle="Download your complete AROHA Life OS dataset as JSON" />
          <p className="text-sm text-muted-foreground">
            Includes profile preferences, schedule blocks, templates, habits, check-ins, focus sessions, health logs, journal entries, goals, learning logs, flashcards, and reminders.
          </p>
          <Button onClick={handleExport} disabled={busy} className="glow-primary">
            <Download className="h-4 w-4" /> Download JSON Backup
          </Button>
        </div>

        <form onSubmit={handleImport} className="card-surface p-6 space-y-4">
          <SectionHeader title="Import & Merge Backup" subtitle="Select a backup file or paste exported JSON" />
          <input
            type="file"
            accept="application/json"
            onChange={handleFilePick}
            className="block w-full text-xs text-muted-foreground file:mr-3 file:rounded-lg file:border file:border-border file:bg-surface file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-foreground cursor-pointer"
          />
          <Textarea
            value={importJson}
            onChange={(e) => setImportJson(e.target.value)}
            placeholder='{"profile": {...}, "scheduleBlocks": [...]}'
            className="min-h-[120px] font-mono text-xs"
          />
          <Button type="submit" variant="outline" disabled={busy || !importJson.trim()}>
            <Upload className="h-4 w-4" /> Import JSON
          </Button>
        </form>
      </div>
    </AppShell>
  );
}
