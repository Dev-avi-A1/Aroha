import crypto from 'node:crypto';
import dns from 'node:dns/promises';
import type { Request } from 'express';
import { TRUSTED_MAIL_PROVIDERS } from './email-guard.ts';

const CHALLENGE_SECRET =
  process.env.AUTH_CHALLENGE_SECRET && process.env.AUTH_CHALLENGE_SECRET.length >= 16
    ? process.env.AUTH_CHALLENGE_SECRET
    : crypto.randomBytes(32).toString('hex');

const CHALLENGE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MIN_HUMAN_SOLVE_MS = 1500; // Automated scripts submit instantaneously (< 1.5s)

// Track consumed challenge nonces to block replay attacks
const usedNonces = new Map<string, number>();

// Sliding window rate limits and brute-force lockouts
interface RateBucket {
  timestamps: number[];
  blockedUntil: number;
}

const rateBuckets = new Map<string, RateBucket>();

function pruneExpiredState(now: number) {
  if (usedNonces.size > 5000) {
    for (const [nonce, exp] of usedNonces.entries()) {
      if (exp <= now) usedNonces.delete(nonce);
    }
  }
  if (rateBuckets.size > 5000) {
    for (const [key, bucket] of rateBuckets.entries()) {
      const latest = bucket.timestamps[bucket.timestamps.length - 1] ?? 0;
      if (bucket.blockedUntil <= now && now - latest > 30 * 60 * 1000) {
        rateBuckets.delete(key);
      }
    }
  }
}

export function getClientIp(req: Request): string {
  // Relies on Express `trust proxy` configuration so spoofed X-Forwarded-For headers cannot bypass rate limits
  return req.ip || req.socket.remoteAddress || 'unknown';
}

export function detectAutomatedClient(req: Request): { suspicious: boolean; reason?: string } {
  const ua = (req.headers['user-agent'] || '').trim();
  if (!ua || ua.length < 10) {
    return { suspicious: true, reason: 'Automated or missing browser user-agent detected.' };
  }
  if (/curl\/|wget\/|python-requests|aiohttp|scrapy|httpie|postmanruntime|headlesschrome|phantomjs/i.test(ua)) {
    return { suspicious: true, reason: 'Automated script client blocked on authentication endpoint.' };
  }
  return { suspicious: false };
}

export function checkRateLimit(
  bucketKey: string,
  maxAttempts: number,
  windowMs: number,
  cooldownMs: number = 5 * 60 * 1000
): { allowed: boolean; retryAfterSec: number; remaining: number } {
  const now = Date.now();
  pruneExpiredState(now);

  let bucket = rateBuckets.get(bucketKey);
  if (!bucket) {
    bucket = { timestamps: [], blockedUntil: 0 };
    rateBuckets.set(bucketKey, bucket);
  }

  if (bucket.blockedUntil > now) {
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((bucket.blockedUntil - now) / 1000)),
      remaining: 0,
    };
  }

  bucket.timestamps = bucket.timestamps.filter((t) => now - t < windowMs);
  if (bucket.timestamps.length >= maxAttempts) {
    bucket.blockedUntil = now + cooldownMs;
    return {
      allowed: false,
      retryAfterSec: Math.ceil(cooldownMs / 1000),
      remaining: 0,
    };
  }

  bucket.timestamps.push(now);
  return {
    allowed: true,
    retryAfterSec: 0,
    remaining: Math.max(0, maxAttempts - bucket.timestamps.length),
  };
}

export function applyPenaltyLockout(bucketKey: string, durationMs: number) {
  const now = Date.now();
  const bucket = rateBuckets.get(bucketKey) ?? { timestamps: [], blockedUntil: 0 };
  bucket.blockedUntil = Math.max(bucket.blockedUntil, now + durationMs);
  rateBuckets.set(bucketKey, bucket);
}

export function peekRateLimit(bucketKey: string): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  const bucket = rateBuckets.get(bucketKey);
  if (!bucket || bucket.blockedUntil <= now) {
    return { allowed: true, retryAfterSec: 0 };
  }
  return {
    allowed: false,
    retryAfterSec: Math.max(1, Math.ceil((bucket.blockedUntil - now) / 1000)),
  };
}

export function clearRateLimit(bucketKey: string) {
  rateBuckets.delete(bucketKey);
}

export interface ChallengePayload {
  token: string;
  prompt: string;
  issuedAt: number;
  expiresAt: number;
  minSolveMs: number;
}

function signChallengeData(encodedPayload: string): string {
  return crypto.createHmac('sha256', CHALLENGE_SECRET).update(encodedPayload).digest('base64url');
}

export function createSecurityChallenge(): ChallengePayload {
  const now = Date.now();
  const nonce = crypto.randomBytes(12).toString('base64url');
  const a = crypto.randomInt(4, 19);
  const b = crypto.randomInt(2, 14);
  const useAdd = crypto.randomInt(0, 2) === 0;
  const answer = useAdd ? a + b : Math.max(a, b) - Math.min(a, b);
  const prompt = useAdd ? `${a} + ${b}` : `${Math.max(a, b)} - ${Math.min(a, b)}`;

  const payload = {
    n: nonce,
    ans: answer,
    iat: now,
    exp: now + CHALLENGE_TTL_MS,
  };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = signChallengeData(encoded);

  return {
    token: `${encoded}.${sig}`,
    prompt,
    issuedAt: now,
    expiresAt: payload.exp,
    minSolveMs: MIN_HUMAN_SOLVE_MS,
  };
}

export function verifySecurityChallenge(params: {
  token: string;
  answer: string | number;
  honeypot?: string;
}): { ok: boolean; error?: string; botDetected?: boolean } {
  const now = Date.now();
  pruneExpiredState(now);

  // 1. Honeypot trap check
  if (typeof params.honeypot === 'string' && params.honeypot.trim().length > 0) {
    return {
      ok: false,
      botDetected: true,
      error: 'Automated bot submission rejected.',
    };
  }

  // 2. Signature verification
  const parts = (params.token || '').split('.');
  if (parts.length !== 2) {
    return { ok: false, error: 'Security verification token is invalid. Refresh challenge.' };
  }
  const [encoded, sig] = parts;
  if (!encoded || !sig) {
    return { ok: false, error: 'Security verification token is incomplete.' };
  }

  const expectedSig = signChallengeData(encoded);
  const sigBuf = Buffer.from(sig, 'utf8');
  const expectedBuf = Buffer.from(expectedSig, 'utf8');
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return { ok: false, botDetected: true, error: 'Security challenge signature mismatch.' };
  }

  let decoded: { n: string; ans: number; iat: number; exp: number };
  try {
    decoded = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
  } catch {
    return { ok: false, error: 'Malformed security verification token.' };
  }

  if (now > decoded.exp) {
    return { ok: false, error: 'Security challenge expired. Please solve the refreshed challenge.' };
  }

  if (usedNonces.has(decoded.n)) {
    return { ok: false, botDetected: true, error: 'Security challenge already used. Refresh to continue.' };
  }

  if (now - decoded.iat < MIN_HUMAN_SOLVE_MS) {
    return {
      ok: false,
      botDetected: true,
      error: 'Submission was too fast to be human. Wait a moment and retry.',
    };
  }

  const numericAnswer = Number(String(params.answer).trim());
  if (!Number.isFinite(numericAnswer) || numericAnswer !== decoded.ans) {
    return { ok: false, error: 'Human verification answer is incorrect. Try again.' };
  }

  usedNonces.set(decoded.n, decoded.exp);
  return { ok: true };
}

export async function verifyEmailDomainMx(domain: string): Promise<{ valid: boolean; reason?: string }> {
  const cleanDomain = domain.trim().toLowerCase();
  if (!cleanDomain || TRUSTED_MAIL_PROVIDERS.has(cleanDomain)) {
    return { valid: true };
  }

  try {
    const mxPromise = dns.resolveMx(cleanDomain);
    const timeoutPromise = new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), 1500);
    });
    const result = await Promise.race([mxPromise, timeoutPromise]);
    if (result === null) {
      // Fail-open on DNS timeout so slow corporate networks aren't falsely blocked
      return { valid: true };
    }
    if (Array.isArray(result) && result.length > 0) {
      return { valid: true };
    }
    return {
      valid: false,
      reason: `Mail domain @${cleanDomain} has no valid mail server records.`,
    };
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === 'ENOTFOUND' || code === 'ENODATA') {
      return {
        valid: false,
        reason: `Mail domain @${cleanDomain} cannot receive email. Check for typos.`,
      };
    }
    // Fail-open on transient DNS errors
    return { valid: true };
  }
}
