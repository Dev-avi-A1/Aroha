export interface TemplateBlockItem {
  startTime: string;
  endTime: string;
  title: string;
  priority: 'high' | 'medium' | 'low';
  color: 'primary' | 'secondary' | 'success' | 'warning' | 'destructive';
}

export interface PresetTemplateDefinition {
  name: string;
  description: string;
  isPreset: boolean;
  blocks: TemplateBlockItem[];
}

export const DEFAULT_PRESETS: PresetTemplateDefinition[] = [
  {
    name: 'Monk Mode',
    description: 'Zero-distraction 05:30 protocol built for maximal cognitive output and physical discipline.',
    isPreset: true,
    blocks: [
      { startTime: '05:30', endTime: '06:00', title: 'Wake, Hydration & Cold Exposure', priority: 'high', color: 'secondary' },
      { startTime: '06:00', endTime: '07:00', title: 'Physical Conditioning & Mobility', priority: 'high', color: 'success' },
      { startTime: '07:30', endTime: '09:30', title: 'Deep Work Block I — Core Execution', priority: 'high', color: 'primary' },
      { startTime: '10:00', endTime: '12:00', title: 'Deep Work Block II — System Build', priority: 'high', color: 'primary' },
      { startTime: '13:00', endTime: '14:30', title: 'Tactical Reading & Active Recall', priority: 'medium', color: 'warning' },
      { startTime: '16:00', endTime: '17:30', title: 'Operational Admin & Communications', priority: 'low', color: 'secondary' },
      { startTime: '21:00', endTime: '21:30', title: 'Evening Audit, Journal & Shutdown', priority: 'medium', color: 'primary' },
    ],
  },
  {
    name: 'Corporate Execution',
    description: 'Structured high-leverage workday balancing deep strategic blocks with meeting windows.',
    isPreset: true,
    blocks: [
      { startTime: '06:30', endTime: '07:15', title: 'Morning Conditioning & Briefing', priority: 'medium', color: 'success' },
      { startTime: '08:00', endTime: '10:00', title: 'High-Leverage Strategic Output', priority: 'high', color: 'primary' },
      { startTime: '10:30', endTime: '12:00', title: 'Alignment Syncs & Decision Reviews', priority: 'medium', color: 'warning' },
      { startTime: '13:30', endTime: '15:30', title: 'Execution Sprint & Deliverables', priority: 'high', color: 'primary' },
      { startTime: '16:00', endTime: '17:00', title: 'Inbox Zero & Tomorrow Plan', priority: 'low', color: 'secondary' },
    ],
  },
  {
    name: 'Creative Deep Work',
    description: 'Extended uninterrupted studio blocks for writing, design, and architectural synthesis.',
    isPreset: true,
    blocks: [
      { startTime: '07:00', endTime: '08:00', title: 'Walk, Coffee & Unplugged Observation', priority: 'low', color: 'success' },
      { startTime: '08:30', endTime: '11:30', title: 'Primary Creative Immersion', priority: 'high', color: 'primary' },
      { startTime: '13:00', endTime: '15:00', title: 'Iterative Critique & Refinement', priority: 'high', color: 'warning' },
      { startTime: '15:30', endTime: '17:00', title: 'Research & Reference Archiving', priority: 'medium', color: 'secondary' },
    ],
  },
  {
    name: 'Weekend Recovery',
    description: 'Biological restoration, reflection, and light intellectual synthesis without schedule drift.',
    isPreset: true,
    blocks: [
      { startTime: '07:30', endTime: '08:30', title: 'Slow Morning & Zone 2 Cardio', priority: 'medium', color: 'success' },
      { startTime: '10:00', endTime: '11:30', title: 'Weekly Retrospective & Goal Calibration', priority: 'high', color: 'primary' },
      { startTime: '14:00', endTime: '15:30', title: 'Long-Form Reading Session', priority: 'low', color: 'warning' },
      { startTime: '20:30', endTime: '21:15', title: 'Next-Week Monk Mode Prep', priority: 'medium', color: 'secondary' },
    ],
  },
];

export function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map((n) => Number.parseInt(n, 10));
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return h * 60 + m;
}

export function durationLabel(startTime: string, endTime: string): string {
  const diff = Math.max(0, timeToMinutes(endTime) - timeToMinutes(startTime));
  const hrs = Math.floor(diff / 60);
  const mins = diff % 60;
  if (hrs > 0 && mins > 0) return `${hrs}h ${mins}m`;
  if (hrs > 0) return `${hrs}h`;
  return `${mins}m`;
}

export function formatDateISO(date: Date, timezone = 'UTC'): string {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone || 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const y = parts.find((p) => p.type === 'year')?.value ?? '2026';
    const m = parts.find((p) => p.type === 'month')?.value ?? '01';
    const d = parts.find((p) => p.type === 'day')?.value ?? '01';
    return `${y}-${m}-${d}`;
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

export function shiftDateISO(dateStr: string, deltaDays: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
  dt.setUTCDate(dt.getUTCDate() + deltaDays);
  return dt.toISOString().slice(0, 10);
}
