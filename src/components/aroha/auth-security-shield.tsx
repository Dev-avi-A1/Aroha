import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, ShieldAlert, ShieldCheck } from 'lucide-react';
import { validateEmailAddress } from '@/lib/email-guard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export interface SecurityChallengeState {
  token: string;
  prompt: string;
  minSolveMs: number;
  expiresAt: number;
}

export function EmailGuardBadge({ email }: { email: string }) {
  const trimmed = email.trim();
  if (!trimmed || !trimmed.includes('@')) return null;

  const check = validateEmailAddress(trimmed);
  if (check.disposable) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-destructive mt-1.5">
        <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
        <span>Temporary mail blocked (@{check.domain}). Use a permanent mail account.</span>
      </div>
    );
  }

  if (!check.valid) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-warning mt-1.5">
        <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
        <span>{check.reason}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 text-xs text-success mt-1.5">
      <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
      <span>
        {check.trustedProvider
          ? `Verified provider (@${check.domain})`
          : `Valid mail domain (@${check.domain})`}
      </span>
    </div>
  );
}

export function useSecurityShield() {
  const [challenge, setChallenge] = useState<SecurityChallengeState | null>(null);
  const [challengeAnswer, setChallengeAnswer] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [loadingChallenge, setLoadingChallenge] = useState(false);
  const [shieldError, setShieldError] = useState<string | null>(null);

  const loadChallenge = useCallback(async () => {
    setLoadingChallenge(true);
    setShieldError(null);
    setChallengeAnswer('');
    try {
      const res = await fetch('/api/auth/challenge');
      const data = await res.json();
      if (!res.ok) {
        setShieldError(data.error || 'Unable to load security verification.');
        setChallenge(null);
        return;
      }
      setChallenge(data as SecurityChallengeState);
    } catch {
      setShieldError('Unable to reach security verification server.');
    } finally {
      setLoadingChallenge(false);
    }
  }, []);

  useEffect(() => {
    void loadChallenge();
  }, [loadChallenge]);

  const verifyBeforeSubmit = useCallback(
    async (mode: 'login' | 'signup' | 'reset', email: string): Promise<{ ok: boolean; error?: string }> => {
      if (!challenge) {
        await loadChallenge();
        return { ok: false, error: 'Security challenge was refreshed. Solve and try again.' };
      }
      if (!challengeAnswer.trim()) {
        return { ok: false, error: 'Complete the human verification check before continuing.' };
      }

      try {
        const res = await fetch('/api/auth/security-check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode,
            email,
            challengeToken: challenge.token,
            challengeAnswer: challengeAnswer.trim(),
            honeypot,
          }),
        });
        const data = (await res.json().catch(() => ({}))) as { error?: string; allowed?: boolean };
        if (!res.ok || !data.allowed) {
          void loadChallenge();
          return {
            ok: false,
            error: data.error || 'Security verification failed. Please retry.',
          };
        }
        return { ok: true };
      } catch {
        return { ok: false, error: 'Security check network error. Please try again.' };
      }
    },
    [challenge, challengeAnswer, honeypot, loadChallenge]
  );

  return {
    challenge,
    challengeAnswer,
    setChallengeAnswer,
    honeypot,
    setHoneypot,
    loadingChallenge,
    shieldError,
    loadChallenge,
    verifyBeforeSubmit,
  };
}

export function RobotAttackShield({
  challenge,
  challengeAnswer,
  setChallengeAnswer,
  honeypot,
  setHoneypot,
  loadingChallenge,
  shieldError,
  onRefresh,
}: {
  challenge: SecurityChallengeState | null;
  challengeAnswer: string;
  setChallengeAnswer: (val: string) => void;
  honeypot: string;
  setHoneypot: (val: string) => void;
  loadingChallenge: boolean;
  shieldError: string | null;
  onRefresh: () => void;
}) {
  return (
    <div className="rounded-xl border border-border/80 bg-surface/65 p-3.5 space-y-2.5">
      {/* Hidden Honeypot Trap for automated bots */}
      <div className="sr-only" aria-hidden="true">
        <label htmlFor="company-website-hp">Company Website</label>
        <Input
          id="company-website-hp"
          name="company_website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
        />
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
          <ShieldCheck className="h-3.5 w-3.5 text-primary" />
          <span>Human Verification</span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onRefresh}
          disabled={loadingChallenge}
          className="h-7 px-2 text-xs text-muted-foreground"
        >
          <RefreshCw className={`h-3 w-3 ${loadingChallenge ? 'animate-spin' : ''}`} />
          <span className="ml-1">Refresh</span>
        </Button>
      </div>

      {shieldError ? (
        <p className="text-xs text-destructive">{shieldError}</p>
      ) : (
        <div className="flex items-center gap-3">
          <div className="px-3 py-2 rounded-lg bg-background border border-border/80 text-sm font-mono font-semibold text-primary shrink-0 select-none">
            {challenge ? `${challenge.prompt} = ?` : 'Loading...'}
          </div>
          <Input
            type="text"
            inputMode="numeric"
            placeholder="Enter result"
            value={challengeAnswer}
            onChange={(e) => setChallengeAnswer(e.target.value)}
            required
            aria-label="Human security verification answer"
            className="h-9"
          />
        </div>
      )}
    </div>
  );
}
