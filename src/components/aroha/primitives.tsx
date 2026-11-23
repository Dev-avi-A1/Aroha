import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export function ScoreRing({
  value,
  size = 168,
  label = 'Discipline',
  caption,
  className,
}: {
  value: number;
  size?: number;
  label?: string;
  caption?: string;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  const strokeWidth = size > 120 ? 12 : 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;

  const strokeColor =
    clamped >= 75 ? 'var(--success)' : clamped >= 45 ? 'var(--primary)' : 'var(--warning)';

  return (
    <div className={cn('relative inline-flex flex-col items-center justify-center', className)}>
      <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="-rotate-90"
          aria-label={`${label}: ${clamped} out of 100`}
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--surface)"
            strokeWidth={strokeWidth}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{
              transition: 'stroke-dashoffset 900ms cubic-bezier(0.22, 1, 0.36, 1)',
              filter: 'drop-shadow(0 0 12px oklch(0.618 0.207 288 / 35%))',
            }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <div className="flex items-baseline gap-0.5">
            <span className="num text-3xl font-bold tracking-tight text-foreground">{clamped}</span>
            <span className="num text-xs text-muted-foreground">/100</span>
          </div>
          <span className="text-[11px] font-medium text-muted-foreground mt-0.5">{label}</span>
          {caption && (
            <span
              className={cn(
                'mt-1 text-[11px] font-semibold',
                clamped >= 75 ? 'text-success' : clamped >= 45 ? 'text-primary' : 'text-warning'
              )}
            >
              {caption}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export function StatTile({
  label,
  value,
  suffix,
  tone = 'default',
  icon: Icon,
  className,
}: {
  label: string;
  value: string | number;
  suffix?: string;
  tone?: 'default' | 'primary' | 'success' | 'warning';
  icon?: LucideIcon;
  className?: string;
}) {
  const toneText =
    tone === 'primary'
      ? 'text-primary'
      : tone === 'success'
        ? 'text-success'
        : tone === 'warning'
          ? 'text-warning'
          : 'text-foreground';

  return (
    <div className={cn('card-surface p-4 flex flex-col justify-between gap-2', className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground truncate">
          {label}
        </span>
        {Icon && <Icon className={cn('h-4 w-4 shrink-0', toneText)} />}
      </div>
      <div className="flex items-baseline gap-1">
        <span className={cn('num text-2xl font-bold', toneText)}>{value}</span>
        {suffix && <span className="num text-xs text-muted-foreground">{suffix}</span>}
      </div>
    </div>
  );
}

export function Meter({
  value,
  max = 100,
  tone = 'primary',
  className,
}: {
  value: number;
  max?: number;
  tone?: 'primary' | 'success' | 'secondary' | 'warning';
  className?: string;
}) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  const fillClass =
    tone === 'success'
      ? 'bg-success'
      : tone === 'secondary'
        ? 'bg-secondary'
        : tone === 'warning'
          ? 'bg-warning'
          : 'bg-primary';

  return (
    <div className={cn('h-2.5 w-full overflow-hidden rounded-full bg-surface', className)}>
      <div
        className={cn('h-full rounded-full', fillClass)}
        style={{
          width: `${pct}%`,
          transition: 'width 700ms ease-out',
        }}
      />
    </div>
  );
}

export function PageHeading({
  title,
  subtitle,
  action,
  className,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('rise flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0 flex items-center gap-2">{action}</div>}
    </div>
  );
}

export function SectionHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center justify-between gap-3', className)}>
      <div>
        <h2 className="text-base sm:text-lg font-semibold text-foreground">{title}</h2>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
