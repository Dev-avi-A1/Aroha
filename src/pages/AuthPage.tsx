import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Eye,
  EyeOff,
  KeyRound,
  Mail,
  ShieldAlert,
  ShieldCheck,
  User as UserIcon,
} from 'lucide-react';
import { useWorkspace } from '@/context/WorkspaceContext';
import { usePageSEO } from '@/lib/seo';
import { validateEmailAddress } from '@/lib/email-guard';
import {
  EmailGuardBadge,
  RobotAttackShield,
  useSecurityShield,
} from '@/components/aroha/auth-security-shield';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

function getPasswordStrength(pw: string): { score: number; label: string; toneClass: string } {
  if (!pw) return { score: 0, label: 'Enter password', toneClass: 'text-muted-foreground' };
  let score = 0;
  if (pw.length >= 8) score += 1;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score += 1;
  if (/\d/.test(pw)) score += 1;
  if (/[^A-Za-z0-9]/.test(pw)) score += 1;

  if (score <= 1) return { score, label: 'Weak (use 8+ chars, numbers, symbols)', toneClass: 'text-destructive' };
  if (score === 2) return { score, label: 'Moderate', toneClass: 'text-warning' };
  if (score === 3) return { score, label: 'Strong', toneClass: 'text-secondary' };
  return { score, label: 'Tactical Strong', toneClass: 'text-success' };
}

export function AuthPage({ mode }: { mode: 'login' | 'signup' }) {
  const isSignup = mode === 'signup';
  const navigate = useNavigate();
  const {
    firebaseUser,
    authLoading,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    sendResetEmail,
  } = useWorkspace();

  usePageSEO({
    title: isSignup ? 'Create Account — AROHA Life OS' : 'Sign In — AROHA Life OS',
    description: isSignup
      ? 'Create your AROHA Life OS account with Outlook, Yahoo, iCloud, Proton, Gmail, or custom domain email.'
      : 'Sign in to your AROHA Life OS command center with Google or any verified mail account.',
    path: isSignup ? '/signup' : '/login',
  });

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  const shield = useSecurityShield();

  useEffect(() => {
    if (!authLoading && firebaseUser) {
      navigate('/home', { replace: true });
    }
  }, [authLoading, firebaseUser, navigate]);

  useEffect(() => {
    setErrorMsg(null);
    setInfoMsg(null);
    setResetMode(false);
  }, [mode]);

  const strength = getPasswordStrength(password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);

    const emailCheck = validateEmailAddress(email);
    if (!emailCheck.valid) {
      setErrorMsg(emailCheck.reason || 'Please enter a valid permanent email address.');
      return;
    }

    if (resetMode) {
      setSubmitting(true);
      try {
        const verified = await shield.verifyBeforeSubmit('reset', email);
        if (!verified.ok) {
          setErrorMsg(verified.error || 'Security check failed.');
          return;
        }
        await sendResetEmail(email);
        setInfoMsg('Password reset link sent. Check your inbox and spam folder.');
        setResetMode(false);
      } catch (err: unknown) {
        setErrorMsg(err instanceof Error ? err.message : 'Unable to send reset email.');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (isSignup) {
      if (!displayName.trim()) {
        setErrorMsg('Enter your full name or callsign.');
        return;
      }
      if (password.length < 8) {
        setErrorMsg('Password must be at least 8 characters long.');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMsg('Passwords do not match.');
        return;
      }
    }

    setSubmitting(true);
    try {
      const verified = await shield.verifyBeforeSubmit(isSignup ? 'signup' : 'login', email);
      if (!verified.ok) {
        setErrorMsg(verified.error || 'Security verification failed.');
        return;
      }

      if (isSignup) {
        await signUpWithEmail(displayName, email, password);
      } else {
        await signInWithEmail(email, password);
      }
      navigate('/home', { replace: true });
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Authentication failed.');
      void shield.loadChallenge();
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleAuth = async () => {
    setErrorMsg(null);
    setGoogleBusy(true);
    try {
      await signInWithGoogle();
      navigate('/home', { replace: true });
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Google sign-in failed.');
    } finally {
      setGoogleBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Top Bar */}
      <header className="border-b border-border/80 bg-background/85 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 font-heading text-lg font-bold tracking-tight">
            <img src="/app-icon-192.png" alt="AROHA" className="h-8 w-8 rounded-lg" />
            <span>AROHA</span>
          </Link>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/">
                <ArrowLeft className="h-4 w-4" />
                Back
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to={isSignup ? '/login' : '/signup'}>
                {isSignup ? 'Sign In' : 'Create Account'}
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Auth Container */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md rise">
          <section className="card-surface p-6 sm:p-8 space-y-5">
            <div className="text-center space-y-1">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
                {resetMode
                  ? 'Reset your password'
                  : isSignup
                    ? 'Create your account'
                    : 'Sign in to AROHA'}
              </h1>
              <p className="text-xs text-muted-foreground">
                {resetMode
                  ? 'Enter your verified email to receive reset instructions'
                  : isSignup
                    ? 'Use Google or any permanent email address'
                    : 'Access your AROHA command workspace'}
              </p>
            </div>
            {/* Tab Switcher */}
            <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-surface border border-border/70">
              <Link
                to="/login"
                className={`py-2 text-center text-sm font-medium rounded-lg transition-colors ${
                  !isSignup
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Sign In
              </Link>
              <Link
                to="/signup"
                className={`py-2 text-center text-sm font-medium rounded-lg transition-colors ${
                  isSignup
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Sign Up
              </Link>
            </div>

            {/* Google Quick Auth */}
            <Button
              type="button"
              variant="outline"
              onClick={handleGoogleAuth}
              disabled={googleBusy || submitting}
              className="w-full h-11 font-medium"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#EA4335"
                  d="M12 10.2v3.9h5.5c-.2 1.3-1.5 3.8-5.5 3.8-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.9 1.5l2.6-2.5C16.9 3.4 14.7 2.5 12 2.5 6.8 2.5 2.5 6.8 2.5 12S6.8 21.5 12 21.5c6.9 0 9.1-4.8 9.1-7.3 0-.5-.1-.9-.1-1.3H12z"
                />
              </svg>
              <span>{googleBusy ? 'Connecting to Google...' : 'Continue with Google'}</span>
            </Button>

            <div className="relative flex items-center justify-center">
              <div className="border-t border-border/70 w-full" />
              <span className="bg-card px-3 text-[11px] uppercase tracking-[0.12em] text-muted-foreground shrink-0">
                Or use any mail account
              </span>
              <div className="border-t border-border/70 w-full" />
            </div>

            {errorMsg && (
              <div
                role="alert"
                className="rounded-xl border border-destructive/50 bg-destructive/10 px-3.5 py-2.5 text-xs text-destructive flex items-start gap-2"
              >
                <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {infoMsg && (
              <div
                role="status"
                className="rounded-xl border border-success/40 bg-success/10 px-3.5 py-2.5 text-xs text-success flex items-start gap-2"
              >
                <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{infoMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {isSignup && !resetMode && (
                <div className="space-y-1.5">
                  <label htmlFor="auth-display-name" className="text-xs font-medium text-foreground block">
                    Full Name or Callsign
                  </label>
                  <div className="relative">
                    <UserIcon className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                    <Input
                      id="auth-display-name"
                      type="text"
                      placeholder="Aarav Sharma"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      required
                      maxLength={80}
                      className="pl-9"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <label htmlFor="auth-email" className="text-xs font-medium text-foreground block">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                  <Input
                    id="auth-email"
                    type="email"
                    autoComplete="email"
                    placeholder="name@outlook.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    maxLength={254}
                    className="pl-9"
                  />
                </div>
                <EmailGuardBadge email={email} />
              </div>

              {!resetMode && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label htmlFor="auth-password" className="text-xs font-medium text-foreground">
                      Password
                    </label>
                    {!isSignup && (
                      <button
                        type="button"
                        onClick={() => {
                          setResetMode(true);
                          setErrorMsg(null);
                          setInfoMsg(null);
                        }}
                        className="text-xs text-primary hover:underline cursor-pointer"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <KeyRound className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                    <Input
                      id="auth-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete={isSignup ? 'new-password' : 'current-password'}
                      placeholder={isSignup ? 'Minimum 8 characters' : 'Enter your password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={isSignup ? 8 : 1}
                      className="pl-9 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {isSignup && password.length > 0 && (
                    <div className="space-y-1 pt-1">
                      <div className="grid grid-cols-4 gap-1">
                        {[1, 2, 3, 4].map((step) => (
                          <div
                            key={step}
                            className={`h-1 rounded-full ${
                              strength.score >= step
                                ? strength.score >= 3
                                  ? 'bg-success'
                                  : strength.score === 2
                                    ? 'bg-warning'
                                    : 'bg-destructive'
                                : 'bg-muted'
                            }`}
                          />
                        ))}
                      </div>
                      <p className={`text-[11px] ${strength.toneClass}`}>{strength.label}</p>
                    </div>
                  )}
                </div>
              )}

              {isSignup && !resetMode && (
                <div className="space-y-1.5">
                  <label htmlFor="auth-confirm-password" className="text-xs font-medium text-foreground block">
                    Confirm Password
                  </label>
                  <Input
                    id="auth-confirm-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="Re-enter your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={8}
                  />
                </div>
              )}

              <RobotAttackShield
                challenge={shield.challenge}
                challengeAnswer={shield.challengeAnswer}
                setChallengeAnswer={shield.setChallengeAnswer}
                honeypot={shield.honeypot}
                setHoneypot={shield.setHoneypot}
                loadingChallenge={shield.loadingChallenge}
                shieldError={shield.shieldError}
                onRefresh={() => void shield.loadChallenge()}
              />

              <div className="flex flex-col gap-2 pt-1">
                <Button type="submit" disabled={submitting} className="w-full h-11 glow-primary">
                  {submitting
                    ? 'Verifying Security...'
                    : resetMode
                      ? 'Send Reset Instructions'
                      : isSignup
                        ? 'Create Verified Account'
                        : 'Sign In to AROHA'}
                </Button>

                {resetMode && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setResetMode(false);
                      setErrorMsg(null);
                    }}
                  >
                    Back to password login
                  </Button>
                )}
              </div>
            </form>

            <p className="text-center text-xs text-muted-foreground">
              {isSignup ? 'Already have an account? ' : 'New to AROHA? '}
              <Link
                to={isSignup ? '/login' : '/signup'}
                className="text-primary font-medium hover:underline"
              >
                {isSignup ? 'Sign in here' : 'Create an account'}
              </Link>
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
