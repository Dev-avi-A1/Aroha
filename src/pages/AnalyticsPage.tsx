import React, { useState } from 'react';
import { BarChart3, CheckCircle2, Flame, Timer } from 'lucide-react';
import { useWorkspace } from '@/context/WorkspaceContext';
import { AppShell } from '@/components/aroha/app-shell';
import { PageHeading, SectionHeader, StatTile } from '@/components/aroha/primitives';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

export function AnalyticsPage() {
  const { workspace } = useWorkspace();
  const [range, setRange] = useState<'weekly' | 'monthly' | 'yearly'>('weekly');

  if (!workspace) {
    return (
      <AppShell title="Analytics">
        <div className="card-surface p-6 text-sm text-muted-foreground">Loading telemetry...</div>
      </AppShell>
    );
  }

  const { weekly7, monthly30, heatmap91, totalFocusMinutes, highPriorityTotal, highPriorityCompleted } =
    workspace.analytics;

  const highPriorityRate =
    highPriorityTotal > 0 ? Math.round((highPriorityCompleted / highPriorityTotal) * 100) : 100;
  const focusHours = (totalFocusMinutes / 60).toFixed(1);
  const avgWeeklyScore = Math.round(
    weekly7.reduce((s, d) => s + d.score, 0) / Math.max(1, weekly7.length)
  );

  // Aggregate 12 monthly buckets from available records
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const currentMonthIdx = Number.parseInt(workspace.today.slice(5, 7), 10) - 1;
  const yearly12 = Array.from({ length: 12 }, (_, idx) => {
    const mIdx = (currentMonthIdx - 11 + idx + 12) % 12;
    const monthPrefix = `-${String(mIdx + 1).padStart(2, '0')}-`;
    const matching = heatmap91.filter((h) => h.date.includes(monthPrefix));
    const avg = matching.length > 0 ? Math.round(matching.reduce((s, d) => s + d.score, 0) / matching.length) : 0;
    return { label: monthNames[mIdx], score: avg };
  });

  // Build SVG polyline points for Monthly 30-day wave
  const wavePoints = monthly30
    .map((d, i) => {
      const x = (i / Math.max(1, monthly30.length - 1)) * 600;
      const y = 140 - (d.score / 100) * 120;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <AppShell title="Analytics">
      <PageHeading
        title="Performance Intelligence"
        subtitle="Discipline trends, deep focus distribution, and 91-day consistency matrix"
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile label="7-Day Avg Score" value={avgWeeklyScore} suffix="/100" tone="primary" icon={BarChart3} />
        <StatTile label="Deep Focus Total" value={focusHours} suffix="h" tone="default" icon={Timer} />
        <StatTile label="High-Priority Rate" value={highPriorityRate} suffix="%" tone="success" icon={CheckCircle2} />
        <StatTile label="Active Habits" value={workspace.habits.length} tone="warning" icon={Flame} />
      </div>

      {/* Discipline Trends */}
      <div className="card-surface p-6 space-y-5">
        <SectionHeader
          title="Discipline Trends"
          subtitle="Computed directly from schedule blocks, habit check-ins, focus, and biology"
          action={
            <Tabs value={range} onValueChange={(v) => setRange(v as typeof range)}>
              <TabsList>
                <TabsTrigger value="weekly">Weekly</TabsTrigger>
                <TabsTrigger value="monthly">Monthly</TabsTrigger>
                <TabsTrigger value="yearly">Yearly</TabsTrigger>
              </TabsList>
            </Tabs>
          }
        />

        {range === 'weekly' && (
          <div className="grid grid-cols-7 gap-2.5 items-end h-48 pt-4">
            {weekly7.map((d) => (
              <div key={d.date} className="flex flex-col items-center gap-2 h-full justify-end">
                <span className="num text-[11px] text-muted-foreground">{d.score}</span>
                <div className="w-full max-w-[44px] flex-1 bg-surface rounded-xl flex items-end overflow-hidden">
                  <div
                    className="w-full rounded-xl transition-all duration-500"
                    style={{
                      height: `${Math.max(4, d.score)}%`,
                      backgroundColor: 'var(--chart-1)',
                    }}
                  />
                </div>
                <span className="num text-[11px] text-muted-foreground">{d.date.slice(5)}</span>
              </div>
            ))}
          </div>
        )}

        {range === 'monthly' && (
          <div className="space-y-2">
            <svg viewBox="0 0 600 150" className="w-full h-44 overflow-visible">
              <defs>
                <linearGradient id="arohaWave" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-2)" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="var(--chart-2)" stopOpacity="0.02" />
                </linearGradient>
              </defs>
              <polygon
                fill="url(#arohaWave)"
                points={`0,140 ${wavePoints} 600,140`}
              />
              <polyline
                fill="none"
                stroke="var(--chart-2)"
                strokeWidth="2.5"
                strokeLinejoin="round"
                points={wavePoints}
              />
            </svg>
            <div className="flex justify-between text-[11px] num text-muted-foreground">
              <span>{monthly30[0]?.date}</span>
              <span>30-Day Discipline Wave</span>
              <span>{monthly30[monthly30.length - 1]?.date}</span>
            </div>
          </div>
        )}

        {range === 'yearly' && (
          <div className="grid grid-cols-12 gap-1.5 items-end h-48 pt-4">
            {yearly12.map((m) => (
              <div key={m.label} className="flex flex-col items-center gap-1.5 h-full justify-end">
                <span className="num text-[10px] text-muted-foreground">{m.score}</span>
                <div className="w-full flex-1 bg-surface rounded-lg flex items-end overflow-hidden">
                  <div
                    className="w-full rounded-lg"
                    style={{
                      height: `${Math.max(4, m.score)}%`,
                      backgroundColor: 'var(--chart-3)',
                    }}
                  />
                </div>
                <span className="text-[11px] text-muted-foreground">{m.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 91-Day Consistency Heatmap */}
      <div className="card-surface p-6 space-y-4">
        <SectionHeader
          title="91-Day Consistency Heatmap"
          subtitle="Each cell reflects daily habit check-ins and discipline score"
        />
        <div className="grid grid-cols-13 gap-1.5">
          {heatmap91.map((cell) => {
            const bg =
              cell.score >= 75
                ? 'bg-success'
                : cell.score >= 45
                  ? 'bg-primary'
                  : cell.score > 0
                    ? 'bg-secondary/60'
                    : 'bg-surface';
            return (
              <div
                key={cell.date}
                title={`${cell.date} — Score ${cell.score}/100 · ${cell.checkins} habits · ${cell.focusMinutes}m focus`}
                className={`aspect-square rounded-[5px] ${bg} border border-border/40`}
              />
            );
          })}
        </div>
        <div className="flex items-center justify-end gap-3 text-[11px] text-muted-foreground">
          <span>Idle</span>
          <span className="h-3 w-3 rounded-sm bg-surface border border-border" />
          <span className="h-3 w-3 rounded-sm bg-secondary/60" />
          <span className="h-3 w-3 rounded-sm bg-primary" />
          <span className="h-3 w-3 rounded-sm bg-success" />
          <span>Peak</span>
        </div>
      </div>
    </AppShell>
  );
}
