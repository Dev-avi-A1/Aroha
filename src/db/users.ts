import { eq } from 'drizzle-orm';
import { db } from './index.ts';
import {
  coachMessages,
  scheduleTemplates,
  users,
} from './schema.ts';
import { DEFAULT_PRESETS } from '../lib/presets.ts';

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
      await seedFreshWorkspace(userRecord.id);
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

async function seedFreshWorkspace(userId: number) {
  // Seed reusable schedule templates (0 XP — ready to apply from Schedule)
  await db.insert(scheduleTemplates).values(
    DEFAULT_PRESETS.map((preset) => ({
      userId,
      name: preset.name,
      description: preset.description,
      isPreset: preset.isPreset,
      blocksJson: JSON.stringify(preset.blocks),
    }))
  );

  // Seed initial AI Coach greeting (0 XP)
  await db.insert(coachMessages).values([
    {
      userId,
      role: 'assistant',
      content:
        'AROHA Tactical Coach online. Your workspace is initialized at Level 0 (0 XP). Head to Schedule to apply a preset or create your first habits and focus sprint to begin leveling up.',
      contextSnapshot: JSON.stringify({ seeded: true }),
    },
  ]);
}
