import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { toast } from 'sonner';
import { auth, googleAuthProvider } from '../lib/firebase.ts';
import type { TemplateBlockItem } from '../lib/presets.ts';
import type { DailyQuote } from '../lib/quotes.ts';
import { normalizeEmail, validateEmailAddress } from '../lib/email-guard.ts';

export interface WorkspaceUser {
  id: number;
  uid: string;
  email: string;
  displayName: string;
  handle: string;
  avatarUrl: string;
  bio: string;
  timezone: string;
  focusModeEnabled: boolean;
  notificationsEnabled: boolean;
  soundEnabled: boolean;
  soundVolume: number;
  hapticsEnabled: boolean;
  voiceRemindersEnabled: boolean;
  leadTimeMinutes: number;
}

export interface ScheduleBlock {
  id: number;
  date: string;
  startTime: string;
  endTime: string;
  title: string;
  priority: 'high' | 'medium' | 'low';
  color: 'primary' | 'secondary' | 'success' | 'warning' | 'destructive';
  completed: boolean;
  sortOrder: number;
}

export interface ScheduleTemplate {
  id: number;
  name: string;
  description: string;
  isPreset: boolean;
  blocksJson: string;
}

export interface HabitItem {
  id: number;
  title: string;
  cadence: 'daily' | 'weekly' | 'monthly';
  targetQuantity: number;
  unit: string;
  color: 'primary' | 'secondary' | 'success' | 'warning' | 'destructive';
  currentStreak: number;
  bestStreak: number;
}

export interface HabitCheckin {
  id: number;
  habitId: number;
  date: string;
  value: number;
}

export interface FocusSession {
  id: number;
  mode: 'pomodoro' | 'stopwatch';
  durationMinutes: number;
  label: string;
  date: string;
  completedAt: string;
}

export interface HealthLog {
  date: string;
  waterMl: number;
  waterTargetMl: number;
  sleepHours: number;
  sleepTargetHours: number;
  sleepQuality: string;
  trained: boolean;
  trainingNote: string;
}

export interface JournalEntry {
  id: number;
  date: string;
  title: string;
  content: string;
  mood: 'Focused' | 'Calm' | 'Tired' | 'Driven';
  createdAt: string;
}

export interface GoalMilestone {
  id: string;
  title: string;
  done: boolean;
}

export interface GoalItem {
  id: number;
  category: 'Discipline' | 'Physical' | 'Intellectual' | 'Financial';
  title: string;
  deadline: string;
  milestonesJson: string;
  completed: boolean;
}

export interface LearningLog {
  id: number;
  kind: 'book' | 'course' | 'lecture';
  title: string;
  progressCurrent: number;
  progressTotal: number;
  unit: string;
  minutesSpent: number;
  date: string;
}

export interface Flashcard {
  id: number;
  deck: string;
  front: string;
  back: string;
  mastered: boolean;
  reviewCount: number;
}

export interface ReminderItem {
  id: number;
  title: string;
  time: string;
  daysJson: string;
  enabled: boolean;
  snoozedUntil: string;
  voiceAlert: boolean;
}

export interface AchievementBadge {
  key: string;
  title: string;
  description: string;
  xpBonus: number;
  metricLabel: string;
  unlocked: boolean;
  unlockedAt: string | null;
  progress: number;
}

export interface CoachMessage {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  contextSnapshot: string;
  createdAt: string;
}

export interface WorkspaceState {
  today: string;
  quote: DailyQuote;
  user: WorkspaceUser;
  disciplineScore: number;
  disciplineStatus: 'Excellent' | 'Holding' | 'Slipping';
  xp: {
    totalXp: number;
    level: number;
    rank: string;
    currentLevelXp: number;
    nextLevelXp: number;
    progressPercent: number;
    components: Record<string, number>;
  };
  todayHealth: HealthLog;
  scheduleBlocks: ScheduleBlock[];
  templates: ScheduleTemplate[];
  habits: HabitItem[];
  habitCheckins: HabitCheckin[];
  focusSessions: FocusSession[];
  healthLogs: HealthLog[];
  journalEntries: JournalEntry[];
  goals: GoalItem[];
  learningLogs: LearningLog[];
  flashcards: Flashcard[];
  reminders: ReminderItem[];
  achievements: AchievementBadge[];
  coachMessages: CoachMessage[];
  analytics: {
    heatmap91: Array<{ date: string; checkins: number; completedBlocks: number; focusMinutes: number; score: number }>;
    weekly7: Array<{ date: string; checkins: number; completedBlocks: number; focusMinutes: number; score: number }>;
    monthly30: Array<{ date: string; checkins: number; completedBlocks: number; focusMinutes: number; score: number }>;
    totalFocusMinutes: number;
    highPriorityTotal: number;
    highPriorityCompleted: number;
  };
}

interface WorkspaceContextValue {
  firebaseUser: User | null;
  authLoading: boolean;
  workspace: WorkspaceState | null;
  workspaceLoading: boolean;
  workspaceError: string | null;
  lastSyncedAt: string | null;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (displayName: string, email: string, password: string) => Promise<void>;
  sendResetEmail: (email: string) => Promise<void>;
  signOutUser: () => Promise<void>;
  refreshWorkspace: () => Promise<void>;
  apiFetch: <T = unknown>(path: string, init?: RequestInit) => Promise<T>;
  updateProfile: (patch: Partial<WorkspaceUser>) => Promise<void>;
  createBlock: (payload: Omit<ScheduleBlock, 'id'>) => Promise<void>;
  updateBlock: (id: number, patch: Partial<ScheduleBlock>) => Promise<void>;
  deleteBlock: (id: number) => Promise<void>;
  applyTemplate: (date: string, templateId: number, replaceExisting?: boolean) => Promise<void>;
  applyTemplateBatch: (payload: {
    templateId: number;
    dates?: string[];
    startDate?: string;
    endDate?: string;
    weekdays?: number[];
    replaceExisting?: boolean;
    skipPopulatedDays?: boolean;
  }) => Promise<{
    appliedDatesCount: number;
    skippedDatesCount: number;
    insertedBlocksCount: number;
    dates: string[];
  }>;
  saveTemplate: (payload: { id?: number; name: string; description: string; blocks: TemplateBlockItem[] }) => Promise<void>;
  deleteTemplate: (id: number) => Promise<void>;
  createHabit: (payload: Omit<HabitItem, 'id' | 'currentStreak' | 'bestStreak'>) => Promise<void>;
  updateHabit: (id: number, patch: Partial<HabitItem>) => Promise<void>;
  deleteHabit: (id: number) => Promise<void>;
  toggleHabitCheckin: (habitId: number, date: string) => Promise<void>;
  logFocusSession: (payload: { mode: 'pomodoro' | 'stopwatch'; durationMinutes: number; label: string; date: string }) => Promise<void>;
  updateHealth: (payload: Record<string, unknown>) => Promise<void>;
  createJournal: (payload: { date: string; title: string; content: string; mood: JournalEntry['mood'] }) => Promise<void>;
  deleteJournal: (id: number) => Promise<void>;
  createGoal: (payload: { category: GoalItem['category']; title: string; deadline: string; milestones: GoalMilestone[] }) => Promise<void>;
  updateGoal: (id: number, patch: Record<string, unknown>) => Promise<void>;
  deleteGoal: (id: number) => Promise<void>;
  createLearningLog: (payload: Omit<LearningLog, 'id'>) => Promise<void>;
  updateLearningLog: (id: number, patch: Partial<LearningLog>) => Promise<void>;
  deleteLearningLog: (id: number) => Promise<void>;
  createFlashcard: (payload: { deck: string; front: string; back: string }) => Promise<void>;
  updateFlashcard: (id: number, patch: Partial<Flashcard>) => Promise<void>;
  deleteFlashcard: (id: number) => Promise<void>;
  createReminder: (payload: { title: string; time: string; days: string[]; voiceAlert: boolean }) => Promise<void>;
  updateReminder: (id: number, patch: Record<string, unknown>) => Promise<void>;
  deleteReminder: (id: number) => Promise<void>;
  sendCoachMessage: (message: string) => Promise<void>;
  clearCoachHistory: () => Promise<void>;
  resetWorkspace: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);
const CACHE_KEY = 'aroha_offline_snapshot_v1';

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [workspace, setWorkspace] = useState<WorkspaceState | null>(null);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const tokenRef = useRef<string | null>(null);

  const getToken = useCallback(async () => {
    const current = auth.currentUser;
    if (!current) {
      tokenRef.current = null;
      throw new Error('Authentication required');
    }
    const token = await current.getIdToken();
    tokenRef.current = token;
    return token;
  }, []);

  const apiFetch = useCallback(
    async <T = unknown>(urlPath: string, init?: RequestInit): Promise<T> => {
      const token = await getToken();
      const res = await fetch(urlPath, {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          ...(init?.headers || {}),
        },
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(errBody.error || `Request failed (${res.status})`);
      }
      return res.json() as Promise<T>;
    },
    [getToken]
  );

  const refreshWorkspace = useCallback(async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;
    setWorkspaceLoading(true);
    setWorkspaceError(null);
    try {
      const data = await apiFetch<WorkspaceState>('/api/workspace');
      if (auth.currentUser?.uid !== currentUser.uid) return;
      setWorkspace(data);
      const nowIso = new Date().toISOString();
      setLastSyncedAt(nowIso);
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ uid: currentUser.uid, syncedAt: nowIso, data }));
      } catch {
        // Ignore storage quota errors
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unable to sync workspace.';
      setWorkspaceError(msg);
      try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached && !workspace) {
          const parsed = JSON.parse(cached) as { uid?: string; syncedAt: string; data: WorkspaceState };
          if (parsed.uid && parsed.uid === currentUser.uid) {
            setWorkspace(parsed.data);
            setLastSyncedAt(parsed.syncedAt);
          } else {
            localStorage.removeItem(CACHE_KEY);
          }
        }
      } catch {
        // Ignore invalid cache
      }
    } finally {
      setWorkspaceLoading(false);
    }
  }, [apiFetch, workspace]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      setAuthLoading(false);
      if (user) {
        tokenRef.current = await user.getIdToken();
        await refreshWorkspace();
      } else {
        tokenRef.current = null;
        setWorkspace(null);
        setLastSyncedAt(null);
        try {
          localStorage.removeItem(CACHE_KEY);
        } catch {
          // Ignore storage errors
        }
      }
    });
    return () => unsub();
  }, [refreshWorkspace]);

  const formatAuthError = (error: unknown, fallback: string): string => {
    const code = (error as { code?: string })?.code || '';
    switch (code) {
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
        return 'Invalid email or password.';
      case 'auth/email-already-in-use':
        return 'An account with this email already exists. Try signing in instead.';
      case 'auth/weak-password':
        return 'Password must be at least 6 characters with strong complexity.';
      case 'auth/invalid-email':
        return 'Enter a valid email address.';
      case 'auth/too-many-requests':
        return 'Too many attempts detected. Please wait a few minutes and try again.';
      case 'auth/operation-not-allowed':
        return 'Email/Password sign-in is not yet enabled in Firebase Auth console. Enable Email/Password under Authentication > Sign-in method, or use Google Sign-In.';
      case 'auth/popup-closed-by-user':
        return 'Google sign-in popup was closed before completion.';
      default:
        return error instanceof Error ? error.message : fallback;
    }
  };

  const signInWithGoogle = useCallback(async () => {
    try {
      const cred = await signInWithPopup(auth, googleAuthProvider);
      if (cred.user.email) {
        const check = validateEmailAddress(cred.user.email);
        if (!check.valid) {
          await signOut(auth);
          throw new Error(check.reason || 'This email domain is not permitted.');
        }
      }
      toast.success('Authenticated into AROHA.');
    } catch (error: unknown) {
      const msg = formatAuthError(error, 'Sign-in cancelled or failed.');
      toast.error(msg);
      throw new Error(msg);
    }
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    const cleanEmail = normalizeEmail(email);
    const check = validateEmailAddress(cleanEmail);
    if (!check.valid) {
      throw new Error(check.reason || 'Invalid email address.');
    }
    try {
      await signInWithEmailAndPassword(auth, cleanEmail, password);
      fetch('/api/auth/login-telemetry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, outcome: 'success' }),
      }).catch(() => undefined);
      toast.success('Signed in to AROHA.');
    } catch (error: unknown) {
      const telemetryRes = await fetch('/api/auth/login-telemetry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, outcome: 'failed' }),
      })
        .then((r) => r.json() as Promise<{ locked?: boolean; retryAfterSec?: number; remainingAttempts?: number }>)
        .catch(() => null);

      const baseMsg = formatAuthError(error, 'Unable to sign in with email.');
      if (telemetryRes?.locked) {
        throw new Error(
          `Too many failed attempts. Account sign-in temporarily locked for ${telemetryRes.retryAfterSec ?? 900}s.`
        );
      }
      throw new Error(baseMsg);
    }
  }, []);

  const signUpWithEmail = useCallback(
    async (displayName: string, email: string, password: string) => {
      const cleanEmail = normalizeEmail(email);
      const cleanName = displayName.trim();
      const check = validateEmailAddress(cleanEmail);
      if (!check.valid) {
        throw new Error(check.reason || 'Invalid email address.');
      }
      try {
        const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
        if (cleanName) {
          await updateProfile(cred.user, { displayName: cleanName });
        }
        const freshToken = await cred.user.getIdToken(true);
        tokenRef.current = freshToken;
        if (cleanName) {
          await fetch('/api/profile', {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${freshToken}`,
            },
            body: JSON.stringify({ displayName: cleanName }),
          }).catch(() => undefined);
        }
        await sendEmailVerification(cred.user).catch(() => undefined);
        await refreshWorkspace();
        toast.success('Account created. Verification email dispatched.');
      } catch (error: unknown) {
        const msg = formatAuthError(error, 'Unable to create account.');
        throw new Error(msg);
      }
    },
    [refreshWorkspace]
  );

  const sendResetEmail = useCallback(async (email: string) => {
    const cleanEmail = normalizeEmail(email);
    const check = validateEmailAddress(cleanEmail);
    if (!check.valid) {
      throw new Error(check.reason || 'Invalid email address.');
    }
    try {
      await sendPasswordResetEmail(auth, cleanEmail);
      toast.success('Password reset instructions sent to your inbox.');
    } catch (error: unknown) {
      const msg = formatAuthError(error, 'Unable to send reset email.');
      throw new Error(msg);
    }
  }, []);

  const signOutUser = useCallback(async () => {
    await signOut(auth);
    tokenRef.current = null;
    setWorkspace(null);
    setLastSyncedAt(null);
    try {
      localStorage.removeItem(CACHE_KEY);
    } catch {
      // Ignore storage errors
    }
    toast.success('Signed out cleanly.');
  }, []);

  const mutateAndRefresh = useCallback(
    async (fn: () => Promise<unknown>, successMessage?: string) => {
      try {
        await fn();
        await refreshWorkspace();
        if (successMessage) toast.success(successMessage);
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Action failed.';
        toast.error(msg);
        throw error;
      }
    },
    [refreshWorkspace]
  );

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      firebaseUser,
      authLoading,
      workspace,
      workspaceLoading,
      workspaceError,
      lastSyncedAt,
      signInWithGoogle,
      signInWithEmail,
      signUpWithEmail,
      sendResetEmail,
      signOutUser,
      refreshWorkspace,
      apiFetch,
      updateProfile: (patch) =>
        mutateAndRefresh(
          () => apiFetch('/api/profile', { method: 'PATCH', body: JSON.stringify(patch) }),
          'Settings saved'
        ),
      createBlock: (payload) =>
        mutateAndRefresh(
          () => apiFetch('/api/schedule/blocks', { method: 'POST', body: JSON.stringify(payload) }),
          'Time block added'
        ),
      updateBlock: (id, patch) =>
        mutateAndRefresh(() =>
          apiFetch(`/api/schedule/blocks/${id}`, { method: 'PATCH', body: JSON.stringify(patch) })
        ),
      deleteBlock: (id) =>
        mutateAndRefresh(
          () => apiFetch(`/api/schedule/blocks/${id}`, { method: 'DELETE' }),
          'Time block removed'
        ),
      applyTemplate: (date, templateId, replaceExisting = true) =>
        mutateAndRefresh(
          () =>
            apiFetch('/api/schedule/apply-template', {
              method: 'POST',
              body: JSON.stringify({ date, templateId, replaceExisting }),
            }),
          'Template applied to schedule'
        ),
      applyTemplateBatch: async (payload) => {
        try {
          const result = await apiFetch<{
            appliedDatesCount: number;
            skippedDatesCount: number;
            insertedBlocksCount: number;
            dates: string[];
          }>('/api/schedule/apply-template', {
            method: 'POST',
            body: JSON.stringify(payload),
          });
          await refreshWorkspace();
          if (result.appliedDatesCount === 0) {
            toast.info('All selected days already had blocks and were skipped.');
          } else {
            const skipNote = result.skippedDatesCount > 0 ? ` (${result.skippedDatesCount} skipped)` : '';
            toast.success(
              `Scheduled ${result.insertedBlocksCount} blocks across ${result.appliedDatesCount} day${result.appliedDatesCount === 1 ? '' : 's'}${skipNote}`
            );
          }
          return result;
        } catch (error: unknown) {
          const msg = error instanceof Error ? error.message : 'Failed to apply schedule template.';
          toast.error(msg);
          throw error;
        }
      },
      saveTemplate: (payload) =>
        mutateAndRefresh(
          () =>
            apiFetch(payload.id ? `/api/templates/${payload.id}` : '/api/templates', {
              method: payload.id ? 'PATCH' : 'POST',
              body: JSON.stringify(payload),
            }),
          payload.id ? 'Template updated' : 'Template created'
        ),
      deleteTemplate: (id) =>
        mutateAndRefresh(
          () => apiFetch(`/api/templates/${id}`, { method: 'DELETE' }),
          'Template deleted'
        ),
      createHabit: (payload) =>
        mutateAndRefresh(
          () => apiFetch('/api/habits', { method: 'POST', body: JSON.stringify(payload) }),
          'Habit created'
        ),
      updateHabit: (id, patch) =>
        mutateAndRefresh(
          () => apiFetch(`/api/habits/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
          'Habit updated'
        ),
      deleteHabit: (id) =>
        mutateAndRefresh(
          () => apiFetch(`/api/habits/${id}`, { method: 'DELETE' }),
          'Habit deleted'
        ),
      toggleHabitCheckin: (habitId, date) =>
        mutateAndRefresh(() =>
          apiFetch(`/api/habits/${habitId}/checkin`, { method: 'POST', body: JSON.stringify({ date }) })
        ),
      logFocusSession: (payload) =>
        mutateAndRefresh(
          () => apiFetch('/api/focus/sessions', { method: 'POST', body: JSON.stringify(payload) }),
          'Focus session logged (+10 XP)'
        ),
      updateHealth: (payload) =>
        mutateAndRefresh(() => apiFetch('/api/health', { method: 'POST', body: JSON.stringify(payload) })),
      createJournal: (payload) =>
        mutateAndRefresh(
          () => apiFetch('/api/journal', { method: 'POST', body: JSON.stringify(payload) }),
          'Reflection logged (+15 XP)'
        ),
      deleteJournal: (id) =>
        mutateAndRefresh(
          () => apiFetch(`/api/journal/${id}`, { method: 'DELETE' }),
          'Entry deleted'
        ),
      createGoal: (payload) =>
        mutateAndRefresh(
          () => apiFetch('/api/goals', { method: 'POST', body: JSON.stringify(payload) }),
          'Goal initialized'
        ),
      updateGoal: (id, patch) =>
        mutateAndRefresh(() =>
          apiFetch(`/api/goals/${id}`, { method: 'PATCH', body: JSON.stringify(patch) })
        ),
      deleteGoal: (id) =>
        mutateAndRefresh(
          () => apiFetch(`/api/goals/${id}`, { method: 'DELETE' }),
          'Goal deleted'
        ),
      createLearningLog: (payload) =>
        mutateAndRefresh(
          () => apiFetch('/api/learn/logs', { method: 'POST', body: JSON.stringify(payload) }),
          'Learning log recorded'
        ),
      updateLearningLog: (id, patch) =>
        mutateAndRefresh(() =>
          apiFetch(`/api/learn/logs/${id}`, { method: 'PATCH', body: JSON.stringify(patch) })
        ),
      deleteLearningLog: (id) =>
        mutateAndRefresh(
          () => apiFetch(`/api/learn/logs/${id}`, { method: 'DELETE' }),
          'Log deleted'
        ),
      createFlashcard: (payload) =>
        mutateAndRefresh(
          () => apiFetch('/api/learn/flashcards', { method: 'POST', body: JSON.stringify(payload) }),
          'Flashcard added'
        ),
      updateFlashcard: (id, patch) =>
        mutateAndRefresh(() =>
          apiFetch(`/api/learn/flashcards/${id}`, { method: 'PATCH', body: JSON.stringify(patch) })
        ),
      deleteFlashcard: (id) =>
        mutateAndRefresh(
          () => apiFetch(`/api/learn/flashcards/${id}`, { method: 'DELETE' }),
          'Flashcard deleted'
        ),
      createReminder: (payload) =>
        mutateAndRefresh(
          () => apiFetch('/api/reminders', { method: 'POST', body: JSON.stringify(payload) }),
          'Reminder scheduled'
        ),
      updateReminder: (id, patch) =>
        mutateAndRefresh(() =>
          apiFetch(`/api/reminders/${id}`, { method: 'PATCH', body: JSON.stringify(patch) })
        ),
      deleteReminder: (id) =>
        mutateAndRefresh(
          () => apiFetch(`/api/reminders/${id}`, { method: 'DELETE' }),
          'Reminder removed'
        ),
      sendCoachMessage: (message) =>
        mutateAndRefresh(() =>
          apiFetch('/api/coach/chat', { method: 'POST', body: JSON.stringify({ message }) })
        ),
      clearCoachHistory: () =>
        mutateAndRefresh(
          () => apiFetch('/api/coach/history', { method: 'DELETE' }),
          'Coach conversation cleared'
        ),
      resetWorkspace: () =>
        mutateAndRefresh(
          () => apiFetch('/api/account/reset', { method: 'POST' }),
          'Workspace reset to clean Level 0 baseline'
        ),
    }),
    [
      firebaseUser,
      authLoading,
      workspace,
      workspaceLoading,
      workspaceError,
      lastSyncedAt,
      signInWithGoogle,
      signInWithEmail,
      signUpWithEmail,
      sendResetEmail,
      signOutUser,
      refreshWorkspace,
      apiFetch,
      mutateAndRefresh,
    ]
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used inside WorkspaceProvider');
  return ctx;
}
