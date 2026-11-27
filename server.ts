import express from 'express';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { db } from './src/db/index.ts';
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
} from './src/db/schema.ts';
import { getFullWorkspaceState, recomputeHabitStreakInDb } from './src/db/workspace.ts';
import { requireAuth, type AuthRequest } from './src/middleware/auth.ts';
import { generateCoachReply } from './src/lib/gemini.ts';
import { formatDateISO, shiftDateISO } from './src/lib/presets.ts';
import { normalizeEmail, validateEmailAddress } from './src/lib/email-guard.ts';
import {
  applyPenaltyLockout,
  checkRateLimit,
  clearRateLimit,
  createSecurityChallenge,
  detectAutomatedClient,
  getClientIp,
  peekRateLimit,
  verifyEmailDomainMx,
  verifySecurityChallenge,
} from './src/lib/bot-guard.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set('trust proxy', 1);
const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0';

app.disable('x-powered-by');
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  next();
});

app.use(express.json({ limit: '2mb' }));

// Health check, Robots.txt & Sitemap
app.get('/api/health-check', (_req, res) => {
  res.json({ ok: true, service: 'aroha-life-os' });
});

app.get('/robots.txt', (req, res) => {
  const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
  res.type('text/plain').send(`User-agent: Googlebot
Allow: /

User-agent: Bingbot
Allow: /

User-agent: Twitterbot
Allow: /

User-agent: facebookexternalhit
Allow: /

User-agent: *
Allow: /

Sitemap: ${baseUrl}/sitemap.xml
`);
});

app.get('/sitemap.xml', (req, res) => {
  const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
  const lastmod = new Date().toISOString().slice(0, 10);
  const routes = [
    { path: '/', priority: '1.0', changefreq: 'weekly' },
    { path: '/aroha', priority: '0.9', changefreq: 'weekly' },
    { path: '/features', priority: '0.8', changefreq: 'weekly' },
    { path: '/login', priority: '0.7', changefreq: 'monthly' },
    { path: '/signup', priority: '0.7', changefreq: 'monthly' },
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${routes
  .map(
    (route) => `  <url>
    <loc>${baseUrl}${route.path}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${route.changefreq}</changefreq>
    <priority>${route.priority}</priority>
  </url>`
  )
  .join('\n')}
</urlset>`;
  res.header('Content-Type', 'application/xml');
  res.send(xml);
});

// Authentication Security Shield (Bot Guard + Temporary Mail Blocker)
app.get('/api/auth/challenge', (req, res) => {
  const ip = getClientIp(req);
  const botClient = detectAutomatedClient(req);
  if (botClient.suspicious) {
    res.status(403).json({ error: botClient.reason });
    return;
  }

  const limit = checkRateLimit(`challenge:${ip}`, 40, 5 * 60 * 1000, 5 * 60 * 1000);
  if (!limit.allowed) {
    res.status(429).json({
      error: `Too many security challenges requested. Wait ${limit.retryAfterSec}s before retrying.`,
      retryAfterSec: limit.retryAfterSec,
    });
    return;
  }

  const challenge = createSecurityChallenge();
  res.json(challenge);
});

const authSecurityCheckSchema = z.object({
  mode: z.enum(['login', 'signup', 'reset', 'google']),
  email: z.string().max(254).optional(),
  challengeToken: z.string().min(10).max(512),
  challengeAnswer: z.union([z.string().max(16), z.number()]),
  honeypot: z.string().max(200).optional(),
});

app.post('/api/auth/security-check', async (req, res) => {
  const ip = getClientIp(req);
  const botClient = detectAutomatedClient(req);
  if (botClient.suspicious) {
    applyPenaltyLockout(`auth:${ip}`, 10 * 60 * 1000);
    res.status(403).json({ error: botClient.reason, botDetected: true });
    return;
  }

  const rate = checkRateLimit(`auth:${ip}`, 15, 5 * 60 * 1000, 10 * 60 * 1000);
  if (!rate.allowed) {
    res.status(429).json({
      error: `Rate limit exceeded to prevent automated attacks. Try again in ${rate.retryAfterSec}s.`,
      retryAfterSec: rate.retryAfterSec,
    });
    return;
  }

  const parsed = authSecurityCheckSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Complete the security verification fields first.' });
    return;
  }

  const { mode, email, challengeToken, challengeAnswer, honeypot } = parsed.data;

  // Verify signed robot-defense challenge, timing, and honeypot
  const challengeResult = verifySecurityChallenge({
    token: challengeToken,
    answer: challengeAnswer,
    honeypot,
  });

  if (!challengeResult.ok) {
    if (challengeResult.botDetected) {
      applyPenaltyLockout(`auth:${ip}`, 10 * 60 * 1000);
    }
    res.status(challengeResult.botDetected ? 403 : 400).json({
      error: challengeResult.error,
      botDetected: Boolean(challengeResult.botDetected),
    });
    return;
  }

  if (mode !== 'google') {
    if (!email || !email.trim()) {
      res.status(400).json({ error: 'Email address is required.' });
      return;
    }

    const cleanEmail = normalizeEmail(email);

    // Check per-IP+email brute force lockout (read-only)
    const lockoutCheck = peekRateLimit(`loginfail:${ip}:${cleanEmail}`);
    if (!lockoutCheck.allowed) {
      res.status(429).json({
        error: `Too many failed attempts for this account from your network. Retry in ${lockoutCheck.retryAfterSec}s.`,
        retryAfterSec: lockoutCheck.retryAfterSec,
      });
      return;
    }

    const emailCheck = validateEmailAddress(cleanEmail);
    if (!emailCheck.valid) {
      res.status(400).json({
        error: emailCheck.reason || 'Invalid email address.',
        disposable: emailCheck.disposable,
      });
      return;
    }

    if (mode === 'signup') {
      const mxCheck = await verifyEmailDomainMx(emailCheck.domain);
      if (!mxCheck.valid) {
        res.status(400).json({
          error: mxCheck.reason || 'Email domain cannot receive messages.',
          invalidDomain: true,
        });
        return;
      }
    }

    res.json({
      allowed: true,
      email: cleanEmail,
      domain: emailCheck.domain,
      trustedProvider: emailCheck.trustedProvider,
    });
    return;
  }

  res.json({ allowed: true });
});

const loginTelemetrySchema = z.object({
  email: z.string().email().max(254),
  outcome: z.enum(['failed', 'success']),
});

app.post('/api/auth/login-telemetry', (req, res) => {
  const botClient = detectAutomatedClient(req);
  if (botClient.suspicious) {
    res.status(403).json({ error: botClient.reason });
    return;
  }

  const ip = getClientIp(req);
  const telemetryThrottle = checkRateLimit(`telemetry:${ip}`, 20, 5 * 60 * 1000, 5 * 60 * 1000);
  if (!telemetryThrottle.allowed) {
    res.status(429).json({
      error: `Too many authentication telemetry requests. Retry in ${telemetryThrottle.retryAfterSec}s.`,
      retryAfterSec: telemetryThrottle.retryAfterSec,
    });
    return;
  }

  const parsed = loginTelemetrySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid telemetry payload.' });
    return;
  }
  const cleanEmail = normalizeEmail(parsed.data.email);
  const key = `loginfail:${ip}:${cleanEmail}`;

  if (parsed.data.outcome === 'success') {
    clearRateLimit(key);
    res.json({ ok: true, locked: false });
    return;
  }

  const limit = checkRateLimit(key, 5, 15 * 60 * 1000, 15 * 60 * 1000);
  res.json({
    ok: true,
    locked: !limit.allowed,
    remainingAttempts: limit.remaining,
    retryAfterSec: limit.retryAfterSec,
  });
});

// Workspace bootstrap
app.get('/api/workspace', requireAuth, async (req: AuthRequest, res) => {
  try {
    const state = await getFullWorkspaceState(req.dbUserId!);
    res.json(state);
  } catch (error) {
    console.error('GET /api/workspace failed:', error);
    res.status(500).json({ error: 'Failed to load workspace state.' });
  }
});

// Profile & Settings
const safeAvatarUrl = z
  .string()
  .max(150000)
  .refine(
    (val) =>
      val === '' ||
      /^https?:\/\/[^\s]+$/i.test(val) ||
      /^data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=]+$/i.test(val),
    { message: 'Avatar must be an HTTP(S) URL or base64 raster image.' }
  );

const profilePatchSchema = z.object({
  displayName: z.string().min(1).max(80).optional(),
  handle: z.string().min(1).max(40).optional(),
  avatarUrl: safeAvatarUrl.optional(),
  bio: z.string().max(400).optional(),
  timezone: z.string().min(1).max(80).optional(),
  focusModeEnabled: z.boolean().optional(),
  notificationsEnabled: z.boolean().optional(),
  soundEnabled: z.boolean().optional(),
  soundVolume: z.number().int().min(0).max(100).optional(),
  hapticsEnabled: z.boolean().optional(),
  voiceRemindersEnabled: z.boolean().optional(),
  leadTimeMinutes: z.number().int().min(0).max(60).optional(),
});

app.patch('/api/profile', requireAuth, async (req: AuthRequest, res) => {
  const parsed = profilePatchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid profile payload.' });
    return;
  }
  try {
    const [updated] = await db
      .update(users)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(users.id, req.dbUserId!))
      .returning();
    res.json(updated);
  } catch (error) {
    console.error('PATCH /api/profile failed:', error);
    res.status(500).json({ error: 'Failed to update profile.' });
  }
});

// Schedule Blocks
const blockCreateSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  title: z.string().min(1).max(160),
  priority: z.enum(['high', 'medium', 'low']).default('medium'),
  color: z.enum(['primary', 'secondary', 'success', 'warning', 'destructive']).default('primary'),
  completed: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

app.post('/api/schedule/blocks', requireAuth, async (req: AuthRequest, res) => {
  const parsed = blockCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid schedule block payload.' });
    return;
  }
  try {
    const [created] = await db
      .insert(scheduleBlocks)
      .values({
        userId: req.dbUserId!,
        ...parsed.data,
        completed: parsed.data.completed ?? false,
        sortOrder: parsed.data.sortOrder ?? 0,
      })
      .returning();
    res.status(201).json(created);
  } catch (error) {
    console.error('POST /api/schedule/blocks failed:', error);
    res.status(500).json({ error: 'Failed to create schedule block.' });
  }
});

const blockPatchSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  title: z.string().min(1).max(160).optional(),
  priority: z.enum(['high', 'medium', 'low']).optional(),
  color: z.enum(['primary', 'secondary', 'success', 'warning', 'destructive']).optional(),
  completed: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

app.patch('/api/schedule/blocks/:id', requireAuth, async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const parsed = blockPatchSchema.safeParse(req.body);
  if (!Number.isInteger(id) || !parsed.success) {
    res.status(400).json({ error: 'Invalid block update request.' });
    return;
  }
  try {
    const [updated] = await db
      .update(scheduleBlocks)
      .set(parsed.data)
      .where(and(eq(scheduleBlocks.id, id), eq(scheduleBlocks.userId, req.dbUserId!)))
      .returning();
    if (!updated) {
      res.status(404).json({ error: 'Schedule block not found.' });
      return;
    }
    res.json(updated);
  } catch (error) {
    console.error('PATCH /api/schedule/blocks/:id failed:', error);
    res.status(500).json({ error: 'Failed to update schedule block.' });
  }
});

app.delete('/api/schedule/blocks/:id', requireAuth, async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: 'Invalid block ID.' });
    return;
  }
  try {
    await db
      .delete(scheduleBlocks)
      .where(and(eq(scheduleBlocks.id, id), eq(scheduleBlocks.userId, req.dbUserId!)));
    res.json({ deleted: true });
  } catch (error) {
    console.error('DELETE /api/schedule/blocks/:id failed:', error);
    res.status(500).json({ error: 'Failed to delete schedule block.' });
  }
});

app.post('/api/schedule/apply-template', requireAuth, async (req: AuthRequest, res) => {
  const dateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
  const schema = z.object({
    date: dateStringSchema.optional(),
    dates: z.array(dateStringSchema).min(1).max(100).optional(),
    startDate: dateStringSchema.optional(),
    endDate: dateStringSchema.optional(),
    weekdays: z.array(z.number().int().min(0).max(6)).min(1).max(7).optional(),
    templateId: z.number().int(),
    replaceExisting: z.boolean().default(true),
    skipPopulatedDays: z.boolean().default(false),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid apply-template request.' });
    return;
  }

  // Build deduplicated, sorted target dates (capped at 100 days per operation)
  const targetSet = new Set<string>();
  if (parsed.data.date) {
    targetSet.add(parsed.data.date);
  }
  if (parsed.data.dates) {
    for (const d of parsed.data.dates) {
      targetSet.add(d);
    }
  }
  if (parsed.data.startDate && parsed.data.endDate) {
    const start = parsed.data.startDate;
    const end = parsed.data.endDate;
    if (start > end) {
      res.status(400).json({ error: 'Start date must be on or before end date.' });
      return;
    }
    const allowedDays = parsed.data.weekdays ? new Set(parsed.data.weekdays) : null;
    let cursor = start;
    let safetyDays = 0;
    while (cursor <= end && safetyDays < 105) {
      const [y, m, d] = cursor.split('-').map(Number);
      const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
      if (!allowedDays || allowedDays.has(dow)) {
        targetSet.add(cursor);
      }
      cursor = shiftDateISO(cursor, 1);
      safetyDays += 1;
    }
    if (safetyDays >= 105 && cursor <= end) {
      res.status(400).json({ error: 'Date range cannot exceed 100 days per apply action.' });
      return;
    }
  }

  const targetDates = Array.from(targetSet).sort();
  if (targetDates.length === 0) {
    res.status(400).json({ error: 'No matching dates selected.' });
    return;
  }
  if (targetDates.length > 100) {
    res.status(400).json({ error: 'Cannot apply template to more than 100 dates at once.' });
    return;
  }

  try {
    const [tpl] = await db
      .select()
      .from(scheduleTemplates)
      .where(and(eq(scheduleTemplates.id, parsed.data.templateId), eq(scheduleTemplates.userId, req.dbUserId!)))
      .limit(1);
    if (!tpl) {
      res.status(404).json({ error: 'Template not found.' });
      return;
    }
    const items = JSON.parse(tpl.blocksJson) as Array<{
      startTime: string;
      endTime: string;
      title: string;
      priority: string;
      color: string;
    }>;

    let finalDates = targetDates;

    if (parsed.data.replaceExisting) {
      await db
        .delete(scheduleBlocks)
        .where(and(eq(scheduleBlocks.userId, req.dbUserId!), inArray(scheduleBlocks.date, targetDates)));
    } else if (parsed.data.skipPopulatedDays) {
      const populatedRows = await db
        .select({ date: scheduleBlocks.date })
        .from(scheduleBlocks)
        .where(and(eq(scheduleBlocks.userId, req.dbUserId!), inArray(scheduleBlocks.date, targetDates)));
      const populatedSet = new Set(populatedRows.map((r) => r.date));
      finalDates = targetDates.filter((d) => !populatedSet.has(d));
    }

    const rowsToInsert =
      items.length > 0 && finalDates.length > 0
        ? finalDates.flatMap((targetDate) =>
            items.map((b, idx) => ({
              userId: req.dbUserId!,
              date: targetDate,
              startTime: b.startTime,
              endTime: b.endTime,
              title: b.title,
              priority: b.priority || 'medium',
              color: b.color || 'primary',
              completed: false,
              sortOrder: idx,
            }))
          )
        : [];

    const CHUNK_SIZE = 500;
    for (let i = 0; i < rowsToInsert.length; i += CHUNK_SIZE) {
      await db.insert(scheduleBlocks).values(rowsToInsert.slice(i, i + CHUNK_SIZE));
    }

    res.json({
      appliedDatesCount: finalDates.length,
      skippedDatesCount: targetDates.length - finalDates.length,
      insertedBlocksCount: rowsToInsert.length,
      dates: finalDates,
    });
  } catch (error) {
    console.error('POST /api/schedule/apply-template failed:', error);
    res.status(500).json({ error: 'Failed to apply schedule template.' });
  }
});

// Templates CRUD
const templateSchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(300).default(''),
  blocks: z.array(
    z.object({
      startTime: z.string().regex(/^\d{2}:\d{2}$/),
      endTime: z.string().regex(/^\d{2}:\d{2}$/),
      title: z.string().min(1).max(160),
      priority: z.enum(['high', 'medium', 'low']).default('medium'),
      color: z.enum(['primary', 'secondary', 'success', 'warning', 'destructive']).default('primary'),
    })
  ).max(100),
});

app.post('/api/templates', requireAuth, async (req: AuthRequest, res) => {
  const parsed = templateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid template payload.' });
    return;
  }
  try {
    const [created] = await db
      .insert(scheduleTemplates)
      .values({
        userId: req.dbUserId!,
        name: parsed.data.name,
        description: parsed.data.description,
        isPreset: false,
        blocksJson: JSON.stringify(parsed.data.blocks),
      })
      .returning();
    res.status(201).json(created);
  } catch (error) {
    console.error('POST /api/templates failed:', error);
    res.status(500).json({ error: 'Failed to create template.' });
  }
});

app.patch('/api/templates/:id', requireAuth, async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const parsed = templateSchema.safeParse(req.body);
  if (!Number.isInteger(id) || !parsed.success) {
    res.status(400).json({ error: 'Invalid template update.' });
    return;
  }
  try {
    const [updated] = await db
      .update(scheduleTemplates)
      .set({
        name: parsed.data.name,
        description: parsed.data.description,
        blocksJson: JSON.stringify(parsed.data.blocks),
      })
      .where(and(eq(scheduleTemplates.id, id), eq(scheduleTemplates.userId, req.dbUserId!)))
      .returning();
    if (!updated) {
      res.status(404).json({ error: 'Template not found.' });
      return;
    }
    res.json(updated);
  } catch (error) {
    console.error('PATCH /api/templates/:id failed:', error);
    res.status(500).json({ error: 'Failed to update template.' });
  }
});

app.delete('/api/templates/:id', requireAuth, async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: 'Invalid template ID.' });
    return;
  }
  try {
    await db
      .delete(scheduleTemplates)
      .where(and(eq(scheduleTemplates.id, id), eq(scheduleTemplates.userId, req.dbUserId!)));
    res.json({ deleted: true });
  } catch (error) {
    console.error('DELETE /api/templates/:id failed:', error);
    res.status(500).json({ error: 'Failed to delete template.' });
  }
});

// Habits & Check-ins
const habitSchema = z.object({
  title: z.string().min(1).max(120),
  cadence: z.enum(['daily', 'weekly', 'monthly']).default('daily'),
  targetQuantity: z.number().int().min(1).max(100000).default(1),
  unit: z.string().min(1).max(30).default('check'),
  color: z.enum(['primary', 'secondary', 'success', 'warning', 'destructive']).default('primary'),
});

app.post('/api/habits', requireAuth, async (req: AuthRequest, res) => {
  const parsed = habitSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid habit payload.' });
    return;
  }
  try {
    const [created] = await db
      .insert(habits)
      .values({ userId: req.dbUserId!, ...parsed.data })
      .returning();
    res.status(201).json(created);
  } catch (error) {
    console.error('POST /api/habits failed:', error);
    res.status(500).json({ error: 'Failed to create habit.' });
  }
});

app.patch('/api/habits/:id', requireAuth, async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const parsed = habitSchema.partial().safeParse(req.body);
  if (!Number.isInteger(id) || !parsed.success) {
    res.status(400).json({ error: 'Invalid habit update.' });
    return;
  }
  try {
    const [updated] = await db
      .update(habits)
      .set(parsed.data)
      .where(and(eq(habits.id, id), eq(habits.userId, req.dbUserId!)))
      .returning();
    if (!updated) {
      res.status(404).json({ error: 'Habit not found.' });
      return;
    }
    res.json(updated);
  } catch (error) {
    console.error('PATCH /api/habits/:id failed:', error);
    res.status(500).json({ error: 'Failed to update habit.' });
  }
});

app.delete('/api/habits/:id', requireAuth, async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: 'Invalid habit ID.' });
    return;
  }
  try {
    await db
      .delete(habits)
      .where(and(eq(habits.id, id), eq(habits.userId, req.dbUserId!)));
    res.json({ deleted: true });
  } catch (error) {
    console.error('DELETE /api/habits/:id failed:', error);
    res.status(500).json({ error: 'Failed to delete habit.' });
  }
});

app.post('/api/habits/:id/checkin', requireAuth, async (req: AuthRequest, res) => {
  const habitId = Number(req.params.id);
  const schema = z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    value: z.number().int().min(1).max(100000).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!Number.isInteger(habitId) || !parsed.success) {
    res.status(400).json({ error: 'Invalid check-in request.' });
    return;
  }
  try {
    const [habit] = await db
      .select()
      .from(habits)
      .where(and(eq(habits.id, habitId), eq(habits.userId, req.dbUserId!)))
      .limit(1);
    if (!habit) {
      res.status(404).json({ error: 'Habit not found.' });
      return;
    }

    const [existing] = await db
      .select()
      .from(habitCheckins)
      .where(
        and(
          eq(habitCheckins.userId, req.dbUserId!),
          eq(habitCheckins.habitId, habitId),
          eq(habitCheckins.date, parsed.data.date)
        )
      )
      .limit(1);

    let checked = false;
    if (existing) {
      await db
        .delete(habitCheckins)
        .where(and(eq(habitCheckins.id, existing.id), eq(habitCheckins.userId, req.dbUserId!)));
      checked = false;
    } else {
      await db
        .insert(habitCheckins)
        .values({
          userId: req.dbUserId!,
          habitId,
          date: parsed.data.date,
          value: parsed.data.value ?? habit.targetQuantity,
        })
        .onConflictDoNothing();
      checked = true;
    }

    const [u] = await db.select({ timezone: users.timezone }).from(users).where(eq(users.id, req.dbUserId!)).limit(1);
    await recomputeHabitStreakInDb(req.dbUserId!, habitId, u?.timezone || 'UTC');
    res.json({ checked });
  } catch (error) {
    console.error('POST /api/habits/:id/checkin failed:', error);
    res.status(500).json({ error: 'Failed to toggle habit check-in.' });
  }
});

// Focus Sessions
app.post('/api/focus/sessions', requireAuth, async (req: AuthRequest, res) => {
  const schema = z.object({
    mode: z.enum(['pomodoro', 'stopwatch']),
    durationMinutes: z.number().int().min(1).max(600),
    label: z.string().min(1).max(120).default('Deep Work'),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid focus session payload.' });
    return;
  }
  try {
    const [created] = await db
      .insert(focusSessions)
      .values({ userId: req.dbUserId!, ...parsed.data })
      .returning();
    res.status(201).json(created);
  } catch (error) {
    console.error('POST /api/focus/sessions failed:', error);
    res.status(500).json({ error: 'Failed to log focus session.' });
  }
});

// Health & Biological Inputs
app.post('/api/health', requireAuth, async (req: AuthRequest, res) => {
  const schema = z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    waterDeltaMl: z.number().int().min(-3000).max(5000).optional(),
    waterMl: z.number().int().min(0).max(15000).optional(),
    waterTargetMl: z.number().int().min(500).max(10000).optional(),
    sleepHours: z.number().min(0).max(24).optional(),
    sleepTargetHours: z.number().min(4).max(14).optional(),
    sleepQuality: z.enum(['poor', 'fair', 'good', 'optimal']).optional(),
    trained: z.boolean().optional(),
    trainingNote: z.string().max(240).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid health log payload.' });
    return;
  }
  try {
    const [existing] = await db
      .select()
      .from(healthLogs)
      .where(and(eq(healthLogs.userId, req.dbUserId!), eq(healthLogs.date, parsed.data.date)))
      .limit(1);

    const nextWaterMl =
      parsed.data.waterMl !== undefined
        ? parsed.data.waterMl
        : Math.max(0, (existing?.waterMl ?? 0) + (parsed.data.waterDeltaMl ?? 0));

    const values = {
      userId: req.dbUserId!,
      date: parsed.data.date,
      waterMl: nextWaterMl,
      waterTargetMl: parsed.data.waterTargetMl ?? existing?.waterTargetMl ?? 3000,
      sleepHours: parsed.data.sleepHours ?? existing?.sleepHours ?? 0,
      sleepTargetHours: parsed.data.sleepTargetHours ?? existing?.sleepTargetHours ?? 8,
      sleepQuality: parsed.data.sleepQuality ?? existing?.sleepQuality ?? 'optimal',
      trained: parsed.data.trained ?? existing?.trained ?? false,
      trainingNote: parsed.data.trainingNote ?? existing?.trainingNote ?? '',
      updatedAt: new Date(),
    };

    const [upserted] = await db
      .insert(healthLogs)
      .values(values)
      .onConflictDoUpdate({
        target: [healthLogs.userId, healthLogs.date],
        set: values,
      })
      .returning();

    res.json(upserted);
  } catch (error) {
    console.error('POST /api/health failed:', error);
    res.status(500).json({ error: 'Failed to update health metrics.' });
  }
});

// Journal Entries
const journalSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  title: z.string().min(1).max(160),
  content: z.string().min(1).max(10000),
  mood: z.enum(['Focused', 'Calm', 'Tired', 'Driven']),
});

app.post('/api/journal', requireAuth, async (req: AuthRequest, res) => {
  const parsed = journalSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid journal entry.' });
    return;
  }
  try {
    const [created] = await db
      .insert(journalEntries)
      .values({ userId: req.dbUserId!, ...parsed.data })
      .returning();
    res.status(201).json(created);
  } catch (error) {
    console.error('POST /api/journal failed:', error);
    res.status(500).json({ error: 'Failed to save journal entry.' });
  }
});

app.patch('/api/journal/:id', requireAuth, async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const parsed = journalSchema.partial().safeParse(req.body);
  if (!Number.isInteger(id) || !parsed.success) {
    res.status(400).json({ error: 'Invalid journal update.' });
    return;
  }
  try {
    const [updated] = await db
      .update(journalEntries)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(and(eq(journalEntries.id, id), eq(journalEntries.userId, req.dbUserId!)))
      .returning();
    if (!updated) {
      res.status(404).json({ error: 'Journal entry not found.' });
      return;
    }
    res.json(updated);
  } catch (error) {
    console.error('PATCH /api/journal/:id failed:', error);
    res.status(500).json({ error: 'Failed to update journal entry.' });
  }
});

app.delete('/api/journal/:id', requireAuth, async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: 'Invalid journal ID.' });
    return;
  }
  try {
    await db
      .delete(journalEntries)
      .where(and(eq(journalEntries.id, id), eq(journalEntries.userId, req.dbUserId!)));
    res.json({ deleted: true });
  } catch (error) {
    console.error('DELETE /api/journal/:id failed:', error);
    res.status(500).json({ error: 'Failed to delete journal entry.' });
  }
});

// Goals
const goalSchema = z.object({
  category: z.enum(['Discipline', 'Physical', 'Intellectual', 'Financial']).default('Discipline'),
  title: z.string().min(1).max(160),
  deadline: z.string().max(20).default(''),
  milestones: z
    .array(
      z.object({
        id: z.string().max(64),
        title: z.string().min(1).max(200),
        done: z.boolean(),
      })
    )
    .max(50)
    .default([]),
  completed: z.boolean().default(false),
});

app.post('/api/goals', requireAuth, async (req: AuthRequest, res) => {
  const parsed = goalSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid goal payload.' });
    return;
  }
  try {
    const [created] = await db
      .insert(goals)
      .values({
        userId: req.dbUserId!,
        category: parsed.data.category,
        title: parsed.data.title,
        deadline: parsed.data.deadline,
        milestonesJson: JSON.stringify(parsed.data.milestones),
        completed: parsed.data.completed,
      })
      .returning();
    res.status(201).json(created);
  } catch (error) {
    console.error('POST /api/goals failed:', error);
    res.status(500).json({ error: 'Failed to create goal.' });
  }
});

app.patch('/api/goals/:id', requireAuth, async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const parsed = goalSchema.partial().safeParse(req.body);
  if (!Number.isInteger(id) || !parsed.success) {
    res.status(400).json({ error: 'Invalid goal update.' });
    return;
  }
  try {
    const updateSet: Record<string, unknown> = {};
    if (parsed.data.category !== undefined) updateSet.category = parsed.data.category;
    if (parsed.data.title !== undefined) updateSet.title = parsed.data.title;
    if (parsed.data.deadline !== undefined) updateSet.deadline = parsed.data.deadline;
    if (parsed.data.milestones !== undefined) {
      updateSet.milestonesJson = JSON.stringify(parsed.data.milestones);
    }
    if (parsed.data.completed !== undefined) updateSet.completed = parsed.data.completed;

    const [updated] = await db
      .update(goals)
      .set(updateSet)
      .where(and(eq(goals.id, id), eq(goals.userId, req.dbUserId!)))
      .returning();
    if (!updated) {
      res.status(404).json({ error: 'Goal not found.' });
      return;
    }
    res.json(updated);
  } catch (error) {
    console.error('PATCH /api/goals/:id failed:', error);
    res.status(500).json({ error: 'Failed to update goal.' });
  }
});

app.delete('/api/goals/:id', requireAuth, async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: 'Invalid goal ID.' });
    return;
  }
  try {
    await db
      .delete(goals)
      .where(and(eq(goals.id, id), eq(goals.userId, req.dbUserId!)));
    res.json({ deleted: true });
  } catch (error) {
    console.error('DELETE /api/goals/:id failed:', error);
    res.status(500).json({ error: 'Failed to delete goal.' });
  }
});

// Learning Logs & Flashcards
const learningSchema = z.object({
  kind: z.enum(['book', 'course', 'lecture']).default('book'),
  title: z.string().min(1).max(160),
  progressCurrent: z.number().int().min(0).default(0),
  progressTotal: z.number().int().min(1).default(100),
  unit: z.string().min(1).max(30).default('pages'),
  minutesSpent: z.number().int().min(0).default(0),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

app.post('/api/learn/logs', requireAuth, async (req: AuthRequest, res) => {
  const parsed = learningSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid learning log payload.' });
    return;
  }
  try {
    const [created] = await db
      .insert(learningLogs)
      .values({ userId: req.dbUserId!, ...parsed.data })
      .returning();
    res.status(201).json(created);
  } catch (error) {
    console.error('POST /api/learn/logs failed:', error);
    res.status(500).json({ error: 'Failed to create learning log.' });
  }
});

app.patch('/api/learn/logs/:id', requireAuth, async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const parsed = learningSchema.partial().safeParse(req.body);
  if (!Number.isInteger(id) || !parsed.success) {
    res.status(400).json({ error: 'Invalid learning log update.' });
    return;
  }
  try {
    const [updated] = await db
      .update(learningLogs)
      .set(parsed.data)
      .where(and(eq(learningLogs.id, id), eq(learningLogs.userId, req.dbUserId!)))
      .returning();
    if (!updated) {
      res.status(404).json({ error: 'Learning log not found.' });
      return;
    }
    res.json(updated);
  } catch (error) {
    console.error('PATCH /api/learn/logs/:id failed:', error);
    res.status(500).json({ error: 'Failed to update learning log.' });
  }
});

app.delete('/api/learn/logs/:id', requireAuth, async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: 'Invalid learning log ID.' });
    return;
  }
  try {
    await db
      .delete(learningLogs)
      .where(and(eq(learningLogs.id, id), eq(learningLogs.userId, req.dbUserId!)));
    res.json({ deleted: true });
  } catch (error) {
    console.error('DELETE /api/learn/logs/:id failed:', error);
    res.status(500).json({ error: 'Failed to delete learning log.' });
  }
});

const flashcardSchema = z.object({
  deck: z.string().min(1).max(80).default('Stoic Strategy'),
  front: z.string().min(1).max(500),
  back: z.string().min(1).max(1500),
  mastered: z.boolean().optional(),
  reviewCount: z.number().int().min(0).optional(),
});

app.post('/api/learn/flashcards', requireAuth, async (req: AuthRequest, res) => {
  const parsed = flashcardSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid flashcard payload.' });
    return;
  }
  try {
    const [created] = await db
      .insert(flashcards)
      .values({
        userId: req.dbUserId!,
        deck: parsed.data.deck,
        front: parsed.data.front,
        back: parsed.data.back,
        mastered: parsed.data.mastered ?? false,
        reviewCount: parsed.data.reviewCount ?? 0,
      })
      .returning();
    res.status(201).json(created);
  } catch (error) {
    console.error('POST /api/learn/flashcards failed:', error);
    res.status(500).json({ error: 'Failed to create flashcard.' });
  }
});

app.patch('/api/learn/flashcards/:id', requireAuth, async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const parsed = flashcardSchema.partial().safeParse(req.body);
  if (!Number.isInteger(id) || !parsed.success) {
    res.status(400).json({ error: 'Invalid flashcard update.' });
    return;
  }
  try {
    const [updated] = await db
      .update(flashcards)
      .set(parsed.data)
      .where(and(eq(flashcards.id, id), eq(flashcards.userId, req.dbUserId!)))
      .returning();
    if (!updated) {
      res.status(404).json({ error: 'Flashcard not found.' });
      return;
    }
    res.json(updated);
  } catch (error) {
    console.error('PATCH /api/learn/flashcards/:id failed:', error);
    res.status(500).json({ error: 'Failed to update flashcard.' });
  }
});

app.delete('/api/learn/flashcards/:id', requireAuth, async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: 'Invalid flashcard ID.' });
    return;
  }
  try {
    await db
      .delete(flashcards)
      .where(and(eq(flashcards.id, id), eq(flashcards.userId, req.dbUserId!)));
    res.json({ deleted: true });
  } catch (error) {
    console.error('DELETE /api/learn/flashcards/:id failed:', error);
    res.status(500).json({ error: 'Failed to delete flashcard.' });
  }
});

// Reminders
const reminderSchema = z.object({
  title: z.string().min(1).max(160),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  days: z.array(z.string().max(16)).max(7).default(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']),
  enabled: z.boolean().default(true),
  snoozedUntil: z.string().max(40).default(''),
  voiceAlert: z.boolean().default(false),
});

app.post('/api/reminders', requireAuth, async (req: AuthRequest, res) => {
  const parsed = reminderSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid reminder payload.' });
    return;
  }
  try {
    const [created] = await db
      .insert(reminders)
      .values({
        userId: req.dbUserId!,
        title: parsed.data.title,
        time: parsed.data.time,
        daysJson: JSON.stringify(parsed.data.days),
        enabled: parsed.data.enabled,
        snoozedUntil: parsed.data.snoozedUntil,
        voiceAlert: parsed.data.voiceAlert,
      })
      .returning();
    res.status(201).json(created);
  } catch (error) {
    console.error('POST /api/reminders failed:', error);
    res.status(500).json({ error: 'Failed to create reminder.' });
  }
});

app.patch('/api/reminders/:id', requireAuth, async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const parsed = reminderSchema.partial().safeParse(req.body);
  if (!Number.isInteger(id) || !parsed.success) {
    res.status(400).json({ error: 'Invalid reminder update.' });
    return;
  }
  try {
    const updateSet: Record<string, unknown> = {};
    if (parsed.data.title !== undefined) updateSet.title = parsed.data.title;
    if (parsed.data.time !== undefined) updateSet.time = parsed.data.time;
    if (parsed.data.days !== undefined) updateSet.daysJson = JSON.stringify(parsed.data.days);
    if (parsed.data.enabled !== undefined) updateSet.enabled = parsed.data.enabled;
    if (parsed.data.snoozedUntil !== undefined) updateSet.snoozedUntil = parsed.data.snoozedUntil;
    if (parsed.data.voiceAlert !== undefined) updateSet.voiceAlert = parsed.data.voiceAlert;

    const [updated] = await db
      .update(reminders)
      .set(updateSet)
      .where(and(eq(reminders.id, id), eq(reminders.userId, req.dbUserId!)))
      .returning();
    if (!updated) {
      res.status(404).json({ error: 'Reminder not found.' });
      return;
    }
    res.json(updated);
  } catch (error) {
    console.error('PATCH /api/reminders/:id failed:', error);
    res.status(500).json({ error: 'Failed to update reminder.' });
  }
});

app.delete('/api/reminders/:id', requireAuth, async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: 'Invalid reminder ID.' });
    return;
  }
  try {
    await db
      .delete(reminders)
      .where(and(eq(reminders.id, id), eq(reminders.userId, req.dbUserId!)));
    res.json({ deleted: true });
  } catch (error) {
    console.error('DELETE /api/reminders/:id failed:', error);
    res.status(500).json({ error: 'Failed to delete reminder.' });
  }
});

// AROHA AI Coach (Server-side Gemini)
app.post('/api/coach/chat', requireAuth, async (req: AuthRequest, res) => {
  const coachRate = checkRateLimit(`coach:${req.dbUserId!}`, 20, 5 * 60 * 1000, 5 * 60 * 1000);
  if (!coachRate.allowed) {
    res.status(429).json({
      error: `Coach rate limit reached. Please wait ${coachRate.retryAfterSec}s before sending another message.`,
    });
    return;
  }

  const schema = z.object({ message: z.string().min(1).max(4000) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Message cannot be empty.' });
    return;
  }
  try {
    const state = await getFullWorkspaceState(req.dbUserId!);
    const todayBlocks = state.scheduleBlocks.filter((b) => b.date === state.today);
    const completedBlocks = todayBlocks.filter((b) => b.completed).length;
    const todayCheckins = state.habitCheckins.filter((c) => c.date === state.today).length;
    const habitRatePercent =
      state.habits.length > 0 ? Math.round((todayCheckins / state.habits.length) * 100) : 0;
    const focusMinutesToday = state.focusSessions
      .filter((f) => f.date === state.today)
      .reduce((sum, f) => sum + f.durationMinutes, 0);

    const context = {
      date: state.today,
      timezone: state.user.timezone,
      disciplineScore: state.disciplineScore,
      disciplineStatus: state.disciplineStatus,
      completedBlocks,
      totalBlocks: todayBlocks.length,
      habitRatePercent,
      focusMinutesToday,
      waterMlToday: state.todayHealth.waterMl,
      sleepHoursToday: state.todayHealth.sleepHours,
      recentMood: state.journalEntries[0]?.mood ?? 'Unlogged',
      activeGoals: state.goals.filter((g) => !g.completed).map((g) => g.title),
      level: state.xp.level,
      rank: state.xp.rank,
    };

    const reply = await generateCoachReply({
      userMessage: parsed.data.message,
      history: state.coachMessages.map((m) => ({ role: m.role, content: m.content })),
      context,
    });

    const contextJson = JSON.stringify(context);
    const [userMsg] = await db
      .insert(coachMessages)
      .values({
        userId: req.dbUserId!,
        role: 'user',
        content: parsed.data.message,
        contextSnapshot: contextJson,
      })
      .returning();

    const [assistantMsg] = await db
      .insert(coachMessages)
      .values({
        userId: req.dbUserId!,
        role: 'assistant',
        content: reply,
        contextSnapshot: contextJson,
      })
      .returning();

    res.json({ userMessage: userMsg, assistantMessage: assistantMsg, context });
  } catch (error: unknown) {
    console.error('POST /api/coach/chat failed:', error);
    res.status(502).json({ error: 'AROHA AI Coach is temporarily unavailable. Please verify configuration or retry.' });
  }
});

app.delete('/api/coach/history', requireAuth, async (req: AuthRequest, res) => {
  try {
    await db.delete(coachMessages).where(eq(coachMessages.userId, req.dbUserId!));
    res.json({ cleared: true });
  } catch (error) {
    console.error('DELETE /api/coach/history failed:', error);
    res.status(500).json({ error: 'Failed to clear coach history.' });
  }
});

// Sync Export / Import & Account Reset
app.get('/api/sync/export', requireAuth, async (req: AuthRequest, res) => {
  try {
    const state = await getFullWorkspaceState(req.dbUserId!);
    res.json({
      exportedAt: new Date().toISOString(),
      version: '1.0',
      profile: {
        displayName: state.user.displayName,
        handle: state.user.handle,
        bio: state.user.bio,
        timezone: state.user.timezone,
      },
      scheduleBlocks: state.scheduleBlocks,
      templates: state.templates,
      habits: state.habits,
      habitCheckins: state.habitCheckins,
      focusSessions: state.focusSessions,
      healthLogs: state.healthLogs,
      journalEntries: state.journalEntries,
      goals: state.goals,
      learningLogs: state.learningLogs,
      flashcards: state.flashcards,
      reminders: state.reminders,
    });
  } catch (error) {
    console.error('GET /api/sync/export failed:', error);
    res.status(500).json({ error: 'Failed to export workspace.' });
  }
});

const importSchema = z.object({
  profile: z
    .object({
      displayName: z.string().min(1).max(80).optional(),
      handle: z.string().min(1).max(40).optional(),
      bio: z.string().max(400).optional(),
      timezone: z.string().min(1).max(80).optional(),
    })
    .optional(),
  scheduleBlocks: z.array(blockCreateSchema).max(200).optional(),
  habits: z.array(habitSchema).max(100).optional(),
  journalEntries: z.array(journalSchema).max(200).optional(),
  goals: z.array(goalSchema).max(100).optional(),
  reminders: z.array(reminderSchema).max(100).optional(),
});

app.post('/api/sync/import', requireAuth, async (req: AuthRequest, res) => {
  const parsed = importSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid backup JSON format.' });
    return;
  }
  try {
    const uid = req.dbUserId!;
    if (parsed.data.profile) {
      await db
        .update(users)
        .set({
          displayName: parsed.data.profile.displayName || undefined,
          handle: parsed.data.profile.handle || undefined,
          bio: parsed.data.profile.bio || undefined,
          timezone: parsed.data.profile.timezone || undefined,
          updatedAt: new Date(),
        })
        .where(eq(users.id, uid));
    }

    if (parsed.data.scheduleBlocks && parsed.data.scheduleBlocks.length > 0) {
      await db.insert(scheduleBlocks).values(
        parsed.data.scheduleBlocks.slice(0, 100).map((b, idx) => ({
          userId: uid,
          date: b.date,
          startTime: b.startTime,
          endTime: b.endTime,
          title: b.title,
          priority: b.priority,
          color: b.color,
          completed: Boolean(b.completed),
          sortOrder: b.sortOrder ?? idx,
        }))
      );
    }

    if (parsed.data.habits && parsed.data.habits.length > 0) {
      await db.insert(habits).values(
        parsed.data.habits.slice(0, 50).map((h) => ({
          userId: uid,
          title: h.title,
          cadence: h.cadence,
          targetQuantity: h.targetQuantity,
          unit: h.unit,
          color: h.color,
        }))
      );
    }

    if (parsed.data.journalEntries && parsed.data.journalEntries.length > 0) {
      await db.insert(journalEntries).values(
        parsed.data.journalEntries.slice(0, 100).map((j) => ({
          userId: uid,
          date: j.date,
          title: j.title,
          content: j.content,
          mood: j.mood,
        }))
      );
    }

    if (parsed.data.goals && parsed.data.goals.length > 0) {
      await db.insert(goals).values(
        parsed.data.goals.slice(0, 50).map((g) => ({
          userId: uid,
          category: g.category,
          title: g.title,
          deadline: g.deadline,
          milestonesJson: JSON.stringify(g.milestones),
          completed: g.completed,
        }))
      );
    }

    if (parsed.data.reminders && parsed.data.reminders.length > 0) {
      await db.insert(reminders).values(
        parsed.data.reminders.slice(0, 50).map((r) => ({
          userId: uid,
          title: r.title,
          time: r.time,
          daysJson: JSON.stringify(r.days),
          enabled: r.enabled,
          snoozedUntil: r.snoozedUntil,
          voiceAlert: r.voiceAlert,
        }))
      );
    }

    res.json({ imported: true });
  } catch (error) {
    console.error('POST /api/sync/import failed:', error);
    res.status(500).json({ error: 'Failed to import backup JSON.' });
  }
});

app.post('/api/account/reset', requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.dbUserId!;
    await Promise.all([
      db.delete(scheduleBlocks).where(eq(scheduleBlocks.userId, uid)),
      db.delete(scheduleTemplates).where(eq(scheduleTemplates.userId, uid)),
      db.delete(habitCheckins).where(eq(habitCheckins.userId, uid)),
      db.delete(habits).where(eq(habits.userId, uid)),
      db.delete(focusSessions).where(eq(focusSessions.userId, uid)),
      db.delete(healthLogs).where(eq(healthLogs.userId, uid)),
      db.delete(journalEntries).where(eq(journalEntries.userId, uid)),
      db.delete(goals).where(eq(goals.userId, uid)),
      db.delete(learningLogs).where(eq(learningLogs.userId, uid)),
      db.delete(flashcards).where(eq(flashcards.userId, uid)),
      db.delete(reminders).where(eq(reminders.userId, uid)),
      db.delete(userAchievements).where(eq(userAchievements.userId, uid)),
      db.delete(coachMessages).where(eq(coachMessages.userId, uid)),
    ]);

    await db.update(users).set({ seeded: false, updatedAt: new Date() }).where(eq(users.id, uid));
    // Re-seed curated Monk Mode baseline cleanly
    const [u] = await db.select().from(users).where(eq(users.id, uid)).limit(1);
    const { getOrCreateUser } = await import('./src/db/users.ts');
    if (u) {
      await getOrCreateUser(u.uid, u.email, u.displayName, u.avatarUrl);
    }
    res.json({ reset: true, date: formatDateISO(new Date(), u?.timezone || 'UTC') });
  } catch (error) {
    console.error('POST /api/account/reset failed:', error);
    res.status(500).json({ error: 'Failed to reset workspace.' });
  }
});

// Serve static public assets + Vite middleware or dist build
app.use(express.static(path.join(__dirname, 'public')));

async function startServer() {
  const httpServer = createServer(app);

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        ws: { server: httpServer },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.join(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  httpServer.listen(PORT, HOST, () => {
    console.log(`AROHA Life OS running on http://${HOST}:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start AROHA server:', err);
  process.exit(1);
});
