import { relations } from 'drizzle-orm';
import {
  boolean,
  integer,
  pgTable,
  real,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  displayName: text('display_name').notNull().default('Operator'),
  handle: text('handle').notNull().default('operator'),
  avatarUrl: text('avatar_url').notNull().default(''),
  bio: text('bio').notNull().default('Executing daily protocols with zero noise.'),
  timezone: text('timezone').notNull().default('UTC'),
  focusModeEnabled: boolean('focus_mode_enabled').notNull().default(false),
  notificationsEnabled: boolean('notifications_enabled').notNull().default(true),
  soundEnabled: boolean('sound_enabled').notNull().default(true),
  soundVolume: integer('sound_volume').notNull().default(70),
  hapticsEnabled: boolean('haptics_enabled').notNull().default(true),
  voiceRemindersEnabled: boolean('voice_reminders_enabled').notNull().default(false),
  leadTimeMinutes: integer('lead_time_minutes').notNull().default(10),
  seeded: boolean('seeded').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const scheduleBlocks = pgTable('schedule_blocks', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  date: text('date').notNull(),
  startTime: text('start_time').notNull(),
  endTime: text('end_time').notNull(),
  title: text('title').notNull(),
  priority: text('priority').notNull().default('medium'),
  color: text('color').notNull().default('primary'),
  completed: boolean('completed').notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const scheduleTemplates = pgTable('schedule_templates', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  isPreset: boolean('is_preset').notNull().default(false),
  blocksJson: text('blocks_json').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const habits = pgTable('habits', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  title: text('title').notNull(),
  cadence: text('cadence').notNull().default('daily'),
  targetQuantity: integer('target_quantity').notNull().default(1),
  unit: text('unit').notNull().default('check'),
  color: text('color').notNull().default('primary'),
  currentStreak: integer('current_streak').notNull().default(0),
  bestStreak: integer('best_streak').notNull().default(0),
  archived: boolean('archived').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const habitCheckins = pgTable(
  'habit_checkins',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    habitId: integer('habit_id')
      .references(() => habits.id, { onDelete: 'cascade' })
      .notNull(),
    date: text('date').notNull(),
    value: integer('value').notNull().default(1),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [uniqueIndex('habit_checkin_unique_idx').on(table.habitId, table.date)]
);

export const focusSessions = pgTable('focus_sessions', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  mode: text('mode').notNull().default('pomodoro'),
  durationMinutes: integer('duration_minutes').notNull(),
  label: text('label').notNull().default('Deep Work'),
  date: text('date').notNull(),
  completedAt: timestamp('completed_at').defaultNow().notNull(),
});

export const healthLogs = pgTable(
  'health_logs',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    date: text('date').notNull(),
    waterMl: integer('water_ml').notNull().default(0),
    waterTargetMl: integer('water_target_ml').notNull().default(3000),
    sleepHours: real('sleep_hours').notNull().default(0),
    sleepTargetHours: real('sleep_target_hours').notNull().default(8),
    sleepQuality: text('sleep_quality').notNull().default('optimal'),
    trained: boolean('trained').notNull().default(false),
    trainingNote: text('training_note').notNull().default(''),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [uniqueIndex('health_log_user_date_idx').on(table.userId, table.date)]
);

export const journalEntries = pgTable('journal_entries', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  date: text('date').notNull(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  mood: text('mood').notNull().default('Focused'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const goals = pgTable('goals', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  category: text('category').notNull().default('Discipline'),
  title: text('title').notNull(),
  deadline: text('deadline').notNull().default(''),
  milestonesJson: text('milestones_json').notNull().default('[]'),
  completed: boolean('completed').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const learningLogs = pgTable('learning_logs', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  kind: text('kind').notNull().default('book'),
  title: text('title').notNull(),
  progressCurrent: integer('progress_current').notNull().default(0),
  progressTotal: integer('progress_total').notNull().default(100),
  unit: text('unit').notNull().default('pages'),
  minutesSpent: integer('minutes_spent').notNull().default(0),
  date: text('date').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const flashcards = pgTable('flashcards', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  deck: text('deck').notNull().default('Stoic Strategy'),
  front: text('front').notNull(),
  back: text('back').notNull(),
  mastered: boolean('mastered').notNull().default(false),
  reviewCount: integer('review_count').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const reminders = pgTable('reminders', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  title: text('title').notNull(),
  time: text('time').notNull(),
  daysJson: text('days_json').notNull().default('["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]'),
  enabled: boolean('enabled').notNull().default(true),
  snoozedUntil: text('snoozed_until').notNull().default(''),
  voiceAlert: boolean('voice_alert').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const userAchievements = pgTable(
  'user_achievements',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    badgeKey: text('badge_key').notNull(),
    unlockedAt: timestamp('unlocked_at').defaultNow().notNull(),
  },
  (table) => [uniqueIndex('user_achievement_unique_idx').on(table.userId, table.badgeKey)]
);

export const coachMessages = pgTable('coach_messages', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  role: text('role').notNull(),
  content: text('content').notNull(),
  contextSnapshot: text('context_snapshot').notNull().default(''),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  scheduleBlocks: many(scheduleBlocks),
  scheduleTemplates: many(scheduleTemplates),
  habits: many(habits),
  habitCheckins: many(habitCheckins),
  focusSessions: many(focusSessions),
  healthLogs: many(healthLogs),
  journalEntries: many(journalEntries),
  goals: many(goals),
  learningLogs: many(learningLogs),
  flashcards: many(flashcards),
  reminders: many(reminders),
  achievements: many(userAchievements),
  coachMessages: many(coachMessages),
}));

export const habitsRelations = relations(habits, ({ one, many }) => ({
  user: one(users, { fields: [habits.userId], references: [users.id] }),
  checkins: many(habitCheckins),
}));

export const habitCheckinsRelations = relations(habitCheckins, ({ one }) => ({
  habit: one(habits, { fields: [habitCheckins.habitId], references: [habits.id] }),
  user: one(users, { fields: [habitCheckins.userId], references: [users.id] }),
}));
