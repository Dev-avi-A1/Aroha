import { and, asc, desc, eq } from 'drizzle-orm';
import { db } from './index.ts';
import {
  coachMessages,
  flashcards,
  focusSessions,
  goals,
  habitCheckins,
  habits,
  healthLogs,
  journalEntries,
  learningLogs,
  reminders,
  scheduleBlocks,
  scheduleTemplates,
  userAchievements,
  users,
} from './schema.ts';
import {
  BADGE_DEFINITIONS,
  computeDisciplineScore,
  computeXpBreakdown,
  getDailyQuote,
} from '../lib/xp.ts';
import { formatDateISO, shiftDateISO } from '../lib/presets.ts';

function computeHabitStreaks(dates: string[], today: string): { currentStreak: number; bestStreak: number } {
  if (dates.length === 0) return { currentStreak: 0, bestStreak: 0 };
  const sorted = Array.from(new Set(dates)).sort();
  const dateSet = new Set(sorted);

  // Best streak across sorted dates
  let best = 0;
  let run = 0;
  let prev = '';
  for (const d of sorted) {
    if (!prev || shiftDateISO(prev, 1) === d) {
      run += 1;
    } else {
      run = 1;
    }
    if (run > best) best = run;
    prev = d;
  }

  // Current streak ending today or yesterday
  let current = 0;
  let cursor = dateSet.has(today) ? today : shiftDateISO(today, -1);
  while (dateSet.has(cursor)) {
    current += 1;
    cursor = shiftDateISO(cursor, -1);
  }

  return { currentStreak: current, bestStreak: Math.max(best, current) };
}

export async function recomputeHabitStreakInDb(userId: number, habitId: number, timezone: string) {
  const today = formatDateISO(new Date(), timezone);
  const rows = await db
    .select({ date: habitCheckins.date })
    .from(habitCheckins)
    .where(and(eq(habitCheckins.userId, userId), eq(habitCheckins.habitId, habitId)));

  const { currentStreak, bestStreak } = computeHabitStreaks(
    rows.map((r) => r.date),
    today
  );

  const [existingHabit] = await db
    .select({ bestStreak: habits.bestStreak })
    .from(habits)
    .where(and(eq(habits.id, habitId), eq(habits.userId, userId)))
    .limit(1);

  const maxBest = Math.max(bestStreak, existingHabit?.bestStreak ?? 0);
  await db
    .update(habits)
    .set({ currentStreak, bestStreak: maxBest })
    .where(and(eq(habits.id, habitId), eq(habits.userId, userId)));
}

export async function getFullWorkspaceState(userId: number) {
  try {
    const [userRow] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!userRow) {
      throw new Error('User record not found.');
    }

    const today = formatDateISO(new Date(), userRow.timezone);

    const [
      blockRows,
      templateRows,
      habitRows,
      checkinRows,
      focusRows,
      healthRows,
      journalRows,
      goalRows,
      learningRows,
      flashcardRows,
      reminderRows,
      achievementRows,
      coachRows,
    ] = await Promise.all([
      db
        .select()
        .from(scheduleBlocks)
        .where(eq(scheduleBlocks.userId, userId))
        .orderBy(asc(scheduleBlocks.date), asc(scheduleBlocks.startTime), asc(scheduleBlocks.sortOrder)),
      db
        .select()
        .from(scheduleTemplates)
        .where(eq(scheduleTemplates.userId, userId))
        .orderBy(desc(scheduleTemplates.isPreset), asc(scheduleTemplates.id)),
      db
        .select()
        .from(habits)
        .where(and(eq(habits.userId, userId), eq(habits.archived, false)))
        .orderBy(asc(habits.id)),
      db.select().from(habitCheckins).where(eq(habitCheckins.userId, userId)),
      db
        .select()
        .from(focusSessions)
        .where(eq(focusSessions.userId, userId))
        .orderBy(desc(focusSessions.completedAt)),
      db
        .select()
        .from(healthLogs)
        .where(eq(healthLogs.userId, userId))
        .orderBy(desc(healthLogs.date)),
      db
        .select()
        .from(journalEntries)
        .where(eq(journalEntries.userId, userId))
        .orderBy(desc(journalEntries.date), desc(journalEntries.createdAt)),
      db
        .select()
        .from(goals)
        .where(eq(goals.userId, userId))
        .orderBy(asc(goals.completed), asc(goals.id)),
      db
        .select()
        .from(learningLogs)
        .where(eq(learningLogs.userId, userId))
        .orderBy(desc(learningLogs.date), desc(learningLogs.id)),
      db
        .select()
        .from(flashcards)
        .where(eq(flashcards.userId, userId))
        .orderBy(asc(flashcards.id)),
      db
        .select()
        .from(reminders)
        .where(eq(reminders.userId, userId))
        .orderBy(asc(reminders.time)),
      db.select().from(userAchievements).where(eq(userAchievements.userId, userId)),
      db
        .select()
        .from(coachMessages)
        .where(eq(coachMessages.userId, userId))
        .orderBy(asc(coachMessages.createdAt)),
    ]);

    const todayBlocks = blockRows.filter((b) => b.date === today);
    const completedTodayBlocks = todayBlocks.filter((b) => b.completed).length;
    const todayCheckins = checkinRows.filter((c) => c.date === today);
    const todayFocusMins = focusRows
      .filter((f) => f.date === today)
      .reduce((sum, f) => sum + f.durationMinutes, 0);
    const todayHealth = healthRows.find((h) => h.date === today) ?? {
      date: today,
      waterMl: 0,
      waterTargetMl: 3000,
      sleepHours: 0,
      sleepTargetHours: 8,
      sleepQuality: 'optimal',
      trained: false,
      trainingNote: '',
    };

    const { score: disciplineScore, status: disciplineStatus } = computeDisciplineScore({
      totalBlocksToday: todayBlocks.length,
      completedBlocksToday: completedTodayBlocks,
      activeHabitsCount: habitRows.length,
      habitCheckinsToday: todayCheckins.length,
      focusMinutesToday: todayFocusMins,
      waterMlToday: todayHealth.waterMl,
      sleepHoursToday: todayHealth.sleepHours,
    });

    // Evaluate achievement unlocks automatically
    const bestStreak = habitRows.reduce((max, h) => Math.max(max, h.bestStreak), 0);
    const focusByDate = new Map<string, number>();
    for (const s of focusRows) {
      focusByDate.set(s.date, (focusByDate.get(s.date) ?? 0) + s.durationMinutes);
    }
    const maxFocusInDay = Math.max(0, ...Array.from(focusByDate.values()));
    const trainedDaysCount = healthRows.filter((h) => h.trained).length;
    const wakeHabit = habitRows.find((h) => h.title.toLowerCase().includes('wake'));
    const earlyCheckins = wakeHabit
      ? checkinRows.filter((c) => c.habitId === wakeHabit.id).length
      : 0;

    const last30Dates = Array.from({ length: 30 }, (_, i) => shiftDateISO(today, -i));
    const checkinsLast30 = checkinRows.filter((c) => last30Dates.includes(c.date)).length;
    const possibleLast30 = Math.max(1, habitRows.length * 30);
    const rateLast30 = Math.round((checkinsLast30 / possibleLast30) * 100);

    const last7Dates = Array.from({ length: 7 }, (_, i) => shiftDateISO(today, -i));
    const activeDaysLast7 = new Set(checkinRows.filter((c) => last7Dates.includes(c.date)).map((c) => c.date)).size;

    const candidateUnlocks: string[] = [];
    if (bestStreak >= 30) candidateUnlocks.push('30-Day Streak');
    if (earlyCheckins >= 14) candidateUnlocks.push('Early Riser');
    if (maxFocusInDay >= 200) candidateUnlocks.push('Deep Focus');
    if (rateLast30 >= 90 && checkinRows.length >= 15) candidateUnlocks.push('Consistency Master');
    if (trainedDaysCount >= 30) candidateUnlocks.push('Iron Month');
    if (activeDaysLast7 >= 7) candidateUnlocks.push('Dopamine Detox');

    const existingKeys = new Set(achievementRows.map((a) => a.badgeKey));
    const newKeys = candidateUnlocks.filter((k) => !existingKeys.has(k));
    if (newKeys.length > 0) {
      await db
        .insert(userAchievements)
        .values(newKeys.map((badgeKey) => ({ userId, badgeKey })))
        .onConflictDoNothing();
    }

    const finalAchievements = [
      ...achievementRows,
      ...newKeys.map((badgeKey, idx) => ({
        id: -(idx + 1),
        userId,
        badgeKey,
        unlockedAt: new Date(),
      })),
    ];

    const journalDaysCount = new Set(journalRows.map((j) => j.date)).size;
    const healthDaysCount = healthRows.filter((h) => h.waterMl > 0 || h.sleepHours > 0 || h.trained).length;
    const completedBlocksTotal = blockRows.filter((b) => b.completed).length;
    const goalsCompletedCount = goalRows.filter((g) => g.completed).length;

    const xp = computeXpBreakdown({
      checkinsCount: checkinRows.length,
      completedBlocksCount: completedBlocksTotal,
      bestStreak,
      badgesCount: finalAchievements.length,
      focusSessionsCount: focusRows.length,
      journalDaysCount,
      healthDaysCount,
      goalsCompletedCount,
      disciplineScore,
    });

    // Build 91-day consistency heatmap + 7-day / 30-day analytics
    const heatmap91 = Array.from({ length: 91 }, (_, idx) => {
      const dateStr = shiftDateISO(today, -(90 - idx));
      const dayCheckins = checkinRows.filter((c) => c.date === dateStr).length;
      const dayBlocks = blockRows.filter((b) => b.date === dateStr);
      const dayCompleted = dayBlocks.filter((b) => b.completed).length;
      const dayFocus = focusRows
        .filter((f) => f.date === dateStr)
        .reduce((acc, s) => acc + s.durationMinutes, 0);
      const dayHealth = healthRows.find((h) => h.date === dateStr);

      const score =
        dayCheckins === 0 && dayBlocks.length === 0 && dayFocus === 0 && !dayHealth
          ? 0
          : computeDisciplineScore({
              totalBlocksToday: dayBlocks.length,
              completedBlocksToday: dayCompleted,
              activeHabitsCount: habitRows.length,
              habitCheckinsToday: dayCheckins,
              focusMinutesToday: dayFocus,
              waterMlToday: dayHealth?.waterMl ?? 0,
              sleepHoursToday: dayHealth?.sleepHours ?? 0,
            }).score;

      return {
        date: dateStr,
        checkins: dayCheckins,
        completedBlocks: dayCompleted,
        focusMinutes: dayFocus,
        score,
      };
    });

    const badgeProgress = BADGE_DEFINITIONS.map((def) => {
      const unlockedRecord = finalAchievements.find((a) => a.badgeKey === def.key);
      let progress = 0;
      if (def.key === '30-Day Streak') progress = Math.min(100, Math.round((bestStreak / 30) * 100));
      if (def.key === 'Early Riser') progress = Math.min(100, Math.round((earlyCheckins / 14) * 100));
      if (def.key === 'Deep Focus') progress = Math.min(100, Math.round((maxFocusInDay / 200) * 100));
      if (def.key === 'Consistency Master') progress = Math.min(100, Math.round((rateLast30 / 90) * 100));
      if (def.key === 'Iron Month') progress = Math.min(100, Math.round((trainedDaysCount / 30) * 100));
      if (def.key === 'Dopamine Detox') progress = Math.min(100, Math.round((activeDaysLast7 / 7) * 100));

      return {
        ...def,
        unlocked: Boolean(unlockedRecord),
        unlockedAt: unlockedRecord?.unlockedAt ?? null,
        progress: unlockedRecord ? 100 : progress,
      };
    });

    return {
      today,
      quote: getDailyQuote(today, userRow.uid),
      user: userRow,
      disciplineScore,
      disciplineStatus,
      xp,
      todayHealth,
      scheduleBlocks: blockRows,
      templates: templateRows,
      habits: habitRows,
      habitCheckins: checkinRows,
      focusSessions: focusRows,
      healthLogs: healthRows,
      journalEntries: journalRows,
      goals: goalRows,
      learningLogs: learningRows,
      flashcards: flashcardRows,
      reminders: reminderRows,
      achievements: badgeProgress,
      coachMessages: coachRows,
      analytics: {
        heatmap91,
        weekly7: heatmap91.slice(-7),
        monthly30: heatmap91.slice(-30),
        totalFocusMinutes: focusRows.reduce((s, r) => s + r.durationMinutes, 0),
        highPriorityTotal: blockRows.filter((b) => b.priority === 'high').length,
        highPriorityCompleted: blockRows.filter((b) => b.priority === 'high' && b.completed).length,
      },
    };
  } catch (error) {
    console.error('Failed to assemble workspace state:', error);
    throw new Error('Failed to load workspace telemetry.', { cause: error });
  }
}
