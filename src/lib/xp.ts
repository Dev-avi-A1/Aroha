import { quoteForDate, type DailyQuote } from './quotes.ts';

export interface XpInput {
  checkinsCount: number;
  completedBlocksCount: number;
  bestStreak: number;
  badgesCount: number;
  focusSessionsCount: number;
  journalDaysCount: number;
  healthDaysCount: number;
  goalsCompletedCount: number;
  disciplineScore: number;
}

export interface XpBreakdown {
  totalXp: number;
  level: number;
  rank: string;
  currentLevelXp: number;
  nextLevelXp: number;
  progressPercent: number;
  components: {
    checkinsXp: number;
    blocksXp: number;
    streakXp: number;
    badgesXp: number;
    focusXp: number;
    journalXp: number;
    healthXp: number;
    goalsXp: number;
    disciplineXp: number;
  };
}

export interface BadgeDefinition {
  key: string;
  title: string;
  description: string;
  xpBonus: number;
  metricLabel: string;
}

export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  {
    key: '30-Day Streak',
    title: '30-Day Streak',
    description: 'Held one habit for a full 30-day cycle without breaking discipline.',
    xpBonus: 75,
    metricLabel: '30 consecutive days',
  },
  {
    key: 'Early Riser',
    title: 'Early Riser',
    description: '05:30 wake-up protocol executed for 14 consecutive days.',
    xpBonus: 75,
    metricLabel: '14 early blocks',
  },
  {
    key: 'Deep Focus',
    title: 'Deep Focus',
    description: 'Four 50-minute uninterrupted focus sessions completed in a single day.',
    xpBonus: 75,
    metricLabel: '200m focus in one day',
  },
  {
    key: 'Consistency Master',
    title: 'Consistency Master',
    description: 'Maintained 90% habit completion rate over a 30-day window.',
    xpBonus: 75,
    metricLabel: '90% 30-day rate',
  },
  {
    key: 'Iron Month',
    title: 'Iron Month',
    description: 'Physical training logged every day for 30 consecutive days.',
    xpBonus: 75,
    metricLabel: '30 training days',
  },
  {
    key: 'Dopamine Detox',
    title: 'Dopamine Detox',
    description: 'Completed a 7-day digital discipline and focus protocol.',
    xpBonus: 75,
    metricLabel: '7-day detox cycle',
  },
];

export const RANK_LADDER = [
  { name: 'Novice', minLevel: 0, maxLevel: 4, directive: 'Establish baseline routine and daily friction control.' },
  { name: 'Apprentice', minLevel: 5, maxLevel: 9, directive: 'Stabilize streaks and eliminate unscheduled drift.' },
  { name: 'Practitioner', minLevel: 10, maxLevel: 14, directive: 'Sustain multi-hour deep work with biological recovery.' },
  { name: 'Elite', minLevel: 15, maxLevel: 19, directive: 'Execute high-priority blocks under pressure with precision.' },
  { name: 'Master', minLevel: 20, maxLevel: 24, directive: 'Command long-horizon goals and unbroken mental clarity.' },
  { name: 'Sovereign', minLevel: 25, maxLevel: 999, directive: 'Total self-governance. Zero compromise between intent and action.' },
] as const;

export function getRankForLevel(level: number): string {
  const found = RANK_LADDER.find((r) => level >= r.minLevel && level <= r.maxLevel);
  return found ? found.name : 'Sovereign';
}

export function xpThresholdForLevel(level: number): number {
  if (level <= 0) return 0;
  // Level 0 starts at 0 XP; Level 1 unlocks at 100 XP with progressive scaling thereafter
  return Math.round(80 * level + 20 * Math.pow(level, 1.45));
}

export function computeXpBreakdown(input: XpInput): XpBreakdown {
  const components = {
    checkinsXp: input.checkinsCount * 12,
    blocksXp: input.completedBlocksCount * 6,
    streakXp: input.bestStreak * 20,
    badgesXp: input.badgesCount * 75,
    focusXp: input.focusSessionsCount * 10,
    journalXp: input.journalDaysCount * 15,
    healthXp: input.healthDaysCount * 5,
    goalsXp: input.goalsCompletedCount * 50,
    disciplineXp: Math.max(0, Math.min(100, Math.round(input.disciplineScore))),
  };

  const totalXp =
    components.checkinsXp +
    components.blocksXp +
    components.streakXp +
    components.badgesXp +
    components.focusXp +
    components.journalXp +
    components.healthXp +
    components.goalsXp +
    components.disciplineXp;

  let level = 0;
  while (xpThresholdForLevel(level + 1) <= totalXp && level < 100) {
    level += 1;
  }

  const currentFloor = xpThresholdForLevel(level);
  const nextFloor = xpThresholdForLevel(level + 1);
  const span = Math.max(1, nextFloor - currentFloor);
  const currentLevelXp = totalXp - currentFloor;
  const nextLevelXp = nextFloor - currentFloor;
  const progressPercent = Math.min(100, Math.max(0, Math.round((currentLevelXp / span) * 100)));

  return {
    totalXp,
    level,
    rank: getRankForLevel(level),
    currentLevelXp,
    nextLevelXp,
    progressPercent,
    components,
  };
}

export function computeDisciplineScore(params: {
  totalBlocksToday: number;
  completedBlocksToday: number;
  activeHabitsCount: number;
  habitCheckinsToday: number;
  focusMinutesToday: number;
  waterMlToday: number;
  sleepHoursToday: number;
}): { score: number; status: 'Excellent' | 'Holding' | 'Slipping' } {
  const blockRatio =
    params.totalBlocksToday > 0
      ? params.completedBlocksToday / params.totalBlocksToday
      : 0;
  const habitRatio =
    params.activeHabitsCount > 0
      ? Math.min(1, params.habitCheckinsToday / params.activeHabitsCount)
      : 0;
  const focusRatio = Math.min(1, params.focusMinutesToday / 100);
  const healthRatio =
    (Math.min(1, params.waterMlToday / 3000) + Math.min(1, params.sleepHoursToday / 8)) / 2;

  const raw = blockRatio * 40 + habitRatio * 35 + focusRatio * 15 + healthRatio * 10;
  const score = Math.max(0, Math.min(100, Math.round(raw)));
  const status = score >= 75 ? 'Excellent' : score >= 45 ? 'Holding' : 'Slipping';
  return { score, status };
}

export type { DailyQuote };

export function getDailyQuote(dateStr: string, userSeed?: string | number): DailyQuote {
  const parts = dateStr.split('-').map(Number);
  if (parts.length === 3 && parts.every((n) => Number.isFinite(n))) {
    const [y, m, d] = parts;
    return quoteForDate(new Date(y, m - 1, d), userSeed);
  }
  return quoteForDate(new Date(), userSeed);
}
