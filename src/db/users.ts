import { eq } from 'drizzle-orm';
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
  users,
} from './schema.ts';
import { DEFAULT_PRESETS, formatDateISO, shiftDateISO } from '../lib/presets.ts';

export async function getOrCreateUser(uid: string, email: string, name?: string, avatarUrl?: string) {
  try {
    const cleanEmail = email || `${uid}@aroha.local`;
    const fallbackName = name?.trim() || cleanEmail.split('@')[0] || 'Operator';
    const handleBase = fallbackName.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 16) || 'operator';

    const existing = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
    let userRecord = existing[0];

    if (!userRecord) {
      const inserted = await db
        .insert(users)
        .values({
          uid,
          email: cleanEmail,
          displayName: fallbackName,
          handle: handleBase,
          avatarUrl: avatarUrl || '',
        })
        .onConflictDoUpdate({
          target: users.uid,
          set: {
            email: cleanEmail,
          },
        })
        .returning();
      userRecord = inserted[0];
    }

    if (userRecord && !userRecord.seeded) {
      await seedCuratedMonkMode(userRecord.id, userRecord.timezone);
      const updated = await db
        .update(users)
        .set({ seeded: true, updatedAt: new Date() })
        .where(eq(users.id, userRecord.id))
        .returning();
      userRecord = updated[0] ?? userRecord;
    }

    return userRecord;
  } catch (error) {
    console.error('Database query failed in getOrCreateUser:', error);
    throw new Error('Failed to initialize user workspace.', { cause: error });
  }
}

async function seedCuratedMonkMode(userId: number, timezone: string) {
  const today = formatDateISO(new Date(), timezone);
  const yesterday = shiftDateISO(today, -1);
  const twoDaysAgo = shiftDateISO(today, -2);

  // 1. Seed Default Templates
  await db.insert(scheduleTemplates).values(
    DEFAULT_PRESETS.map((preset) => ({
      userId,
      name: preset.name,
      description: preset.description,
      isPreset: preset.isPreset,
      blocksJson: JSON.stringify(preset.blocks),
    }))
  );

  // 2. Seed Today's Monk Mode Schedule
  const monkMode = DEFAULT_PRESETS[0];
  await db.insert(scheduleBlocks).values(
    monkMode.blocks.map((block, index) => ({
      userId,
      date: today,
      startTime: block.startTime,
      endTime: block.endTime,
      title: block.title,
      priority: block.priority,
      color: block.color,
      completed: index < 2,
      sortOrder: index,
    }))
  );

  // 3. Seed Starter Discipline Habits
  const insertedHabits = await db
    .insert(habits)
    .values([
      {
        userId,
        title: '05:30 Wake-Up Protocol',
        cadence: 'daily',
        targetQuantity: 1,
        unit: 'check',
        color: 'primary',
        currentStreak: 3,
        bestStreak: 7,
      },
      {
        userId,
        title: 'Deep Focus Execution',
        cadence: 'daily',
        targetQuantity: 50,
        unit: 'minutes',
        color: 'secondary',
        currentStreak: 3,
        bestStreak: 5,
      },
      {
        userId,
        title: 'Hydration Target',
        cadence: 'daily',
        targetQuantity: 3000,
        unit: 'ml',
        color: 'secondary',
        currentStreak: 2,
        bestStreak: 6,
      },
      {
        userId,
        title: 'Physical Conditioning',
        cadence: 'daily',
        targetQuantity: 1,
        unit: 'session',
        color: 'success',
        currentStreak: 2,
        bestStreak: 4,
      },
      {
        userId,
        title: 'Evening Audit & Review',
        cadence: 'daily',
        targetQuantity: 1,
        unit: 'review',
        color: 'warning',
        currentStreak: 1,
        bestStreak: 3,
      },
    ])
    .returning();

  // Seed recent check-ins for immediate 30-day matrix & analytics signal
  const checkinRows: Array<{ userId: number; habitId: number; date: string; value: number }> = [];
  for (const h of insertedHabits.slice(0, 3)) {
    checkinRows.push({ userId, habitId: h.id, date: yesterday, value: h.targetQuantity });
    checkinRows.push({ userId, habitId: h.id, date: twoDaysAgo, value: h.targetQuantity });
  }
  if (insertedHabits[0]) {
    checkinRows.push({ userId, habitId: insertedHabits[0].id, date: today, value: 1 });
  }
  if (checkinRows.length > 0) {
    await db.insert(habitCheckins).values(checkinRows).onConflictDoNothing();
  }

  // 4. Seed Starter Health Logs
  await db
    .insert(healthLogs)
    .values([
      {
        userId,
        date: today,
        waterMl: 1250,
        waterTargetMl: 3000,
        sleepHours: 7.5,
        sleepTargetHours: 8,
        sleepQuality: 'optimal',
        trained: true,
        trainingNote: 'Morning strength & conditioning',
      },
      {
        userId,
        date: yesterday,
        waterMl: 2750,
        waterTargetMl: 3000,
        sleepHours: 8,
        sleepTargetHours: 8,
        sleepQuality: 'optimal',
        trained: true,
        trainingNote: 'Zone 2 endurance',
      },
    ])
    .onConflictDoNothing();

  // 5. Seed Starter Focus Session
  await db.insert(focusSessions).values([
    {
      userId,
      mode: 'pomodoro',
      durationMinutes: 25,
      label: 'Monk Mode Sprint I',
      date: yesterday,
    },
  ]);

  // 6. Seed Starter Journal Entry
  await db.insert(journalEntries).values([
    {
      userId,
      date: today,
      title: 'Protocol Initialization',
      content:
        'Baseline Monk Mode schedule deployed. Focus remains on executing the next immediate block with zero emotional friction.',
      mood: 'Focused',
    },
  ]);

  // 7. Seed Starter Goals
  await db.insert(goals).values([
    {
      userId,
      category: 'Discipline',
      title: 'Complete 30-Day Monk Mode Cycle',
      deadline: shiftDateISO(today, 30),
      milestonesJson: JSON.stringify([
        { id: 'm1', title: 'Maintain 05:30 wake for 7 days', done: true },
        { id: 'm2', title: 'Log 20 hours of deep focus', done: false },
        { id: 'm3', title: 'Reach 85+ weekly discipline score', done: false },
      ]),
      completed: false,
    },
    {
      userId,
      category: 'Physical',
      title: 'Consistent 3000ml Daily Hydration & 8h Sleep',
      deadline: shiftDateISO(today, 14),
      milestonesJson: JSON.stringify([
        { id: 'p1', title: '7 consecutive days of 3L water', done: false },
        { id: 'p2', title: 'Zero screens after 21:30', done: false },
      ]),
      completed: false,
    },
  ]);

  // 8. Seed Learning Log & Flashcards
  await db.insert(learningLogs).values([
    {
      userId,
      kind: 'book',
      title: 'Meditations — Marcus Aurelius',
      progressCurrent: 48,
      progressTotal: 210,
      unit: 'pages',
      minutesSpent: 35,
      date: today,
    },
  ]);

  await db.insert(flashcards).values([
    {
      userId,
      deck: 'Stoic Strategy',
      front: 'What separates tactical execution from emotional drift?',
      back: 'Pre-committed time blocks paired with immediate friction removal before temptation appears.',
      mastered: false,
      reviewCount: 1,
    },
    {
      userId,
      deck: 'Stoic Strategy',
      front: 'Why track biological inputs (sleep & hydration) inside a productivity OS?',
      back: 'Cognitive endurance and impulse control degrade sharply under sleep debt and dehydration.',
      mastered: false,
      reviewCount: 0,
    },
  ]);

  // 9. Seed Starter Reminder & Coach Welcome
  await db.insert(reminders).values([
    {
      userId,
      title: 'Morning Monk Mode Briefing',
      time: '05:30',
      daysJson: JSON.stringify(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']),
      enabled: true,
      voiceAlert: false,
    },
    {
      userId,
      title: 'Evening Shutdown & Journal Audit',
      time: '21:00',
      daysJson: JSON.stringify(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']),
      enabled: true,
      voiceAlert: false,
    },
  ]);

  await db.insert(coachMessages).values([
    {
      userId,
      role: 'assistant',
      content:
        'AROHA Tactical Coach online. Your Monk Mode baseline is initialized. Identify your highest-leverage block for today and report any friction points in your execution.',
      contextSnapshot: JSON.stringify({ seeded: true }),
    },
  ]);
}
