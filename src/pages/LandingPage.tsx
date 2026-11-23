import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  Bot,
  CalendarClock,
  CheckSquare,
  Flame,
  Shield,
  Smartphone,
  Timer,
} from 'lucide-react';
import { useWorkspace } from '@/context/WorkspaceContext';
import { RANK_LADDER } from '@/lib/xp';
import { usePageSEO } from '@/lib/seo';
import { Button } from '@/components/ui/button';
import { ScoreRing, Meter } from '@/components/aroha/primitives';
import { PWAInstallButton } from '@/components/aroha/pwa-controls';

export function LandingPage({ canonical = false }: { canonical?: boolean }) {
  const { firebaseUser, authLoading, signInWithGoogle } = useWorkspace();
  const navigate = useNavigate();

  usePageSEO({
    title: canonical
      ? 'AROHA — Personal Evolution System & Tactical Discipline OS'
      : 'AROHA – Personal Evolution System for Habits, Focus & Schedule',
    description:
      'Master daily discipline with AROHA Life OS. Unify 24-hour time blocking, habit streaks, deep focus timers, biological tracking, and AI coaching.',
    path: canonical ? '/aroha' : '/',
  });

  useEffect(() => {
    if (!authLoading && firebaseUser && !canonical) {
      navigate('/home', { replace: true });
    }
  }, [authLoading, firebaseUser, canonical, navigate]);

  const handleAction = async () => {
    if (firebaseUser) {
      navigate('/home');
      return;
    }
    await signInWithGoogle();
    navigate('/home');
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-30 border-b border-border/80 bg-background/85 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
          <Link
            to="/aroha"
            className="flex items-center gap-2.5 font-heading text-lg font-bold tracking-tight whitespace-nowrap shrink-0"
          >
            <img src="/app-icon-192.png" alt="AROHA" className="h-8 w-8 rounded-lg" />
            <span>AROHA</span>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-muted-foreground">
            <a href="#system" className="hover:text-foreground transition-colors whitespace-nowrap shrink-0">
              System
            </a>
            <Link to="/features" className="hover:text-foreground transition-colors whitespace-nowrap shrink-0">
              Features
            </Link>
            <a href="#progression" className="hover:text-foreground transition-colors whitespace-nowrap shrink-0">
              Progression
            </a>
            <Link to="/aroha" className="hover:text-foreground transition-colors whitespace-nowrap shrink-0">
              Overview
            </Link>
          </nav>

          <div className="shrink-0 flex items-center gap-2">
            {firebaseUser ? (
              <Button onClick={handleAction} size="sm" className="glow-primary whitespace-nowrap shrink-0">
                Open Command
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm" className="whitespace-nowrap shrink-0">
                  <Link to="/login">Sign In</Link>
                </Button>
                <Button asChild size="sm" className="glow-primary whitespace-nowrap shrink-0">
                  <Link to="/signup">Create Account</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-12 pb-14 lg:pt-16 lg:pb-20 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-7 space-y-6 rise">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-primary">
              AROHA Life OS · Personal Evolution System
            </p>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.08] tracking-tight text-foreground">
              The Discipline OS for Habits, Focus, and Time.
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground max-w-xl leading-relaxed">
              AROHA unifies 24-hour time blocking, streak-compounding habits, deep focus telemetry, biological recovery, and an analytical AI coach inside a zero-distraction dark interface.
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-2">
              {firebaseUser ? (
                <Button onClick={handleAction} size="lg" className="glow-primary">
                  Enter Command Center
                  <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <>
                  <Button asChild size="lg" className="glow-primary">
                    <Link to="/signup">
                      Create Account
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="lg">
                    <Link to="/login">Sign In</Link>
                  </Button>
                </>
              )}
              <Button asChild variant="outline" size="lg">
                <Link to="/features">Explore 15 Modules</Link>
              </Button>
              <PWAInstallButton size="default" alwaysShowGuide />
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>Private cloud sync</span>
              <span>·</span>
              <span className="inline-flex items-center gap-1">
                <Smartphone className="h-3.5 w-3.5 text-primary" /> Android &amp; iOS Ready
              </span>
            </div>
          </div>

          <div className="lg:col-span-5 rise">
            <div className="card-surface p-6 sm:p-7 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Daily Overview</p>
                  <h2 className="text-lg font-semibold mt-0.5">Focus &amp; Discipline</h2>
                </div>
              </div>

              <div className="flex items-center justify-center py-2">
                <ScoreRing value={88} size={172} label="Discipline" caption="On Track" />
              </div>

              <div className="space-y-3 pt-2 border-t border-border/70">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Scheduled Focus</span>
                  <span className="num text-foreground font-medium">Completed</span>
                </div>
                <Meter value={100} tone="success" />
                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="text-muted-foreground">Daily Hydration</span>
                  <span className="num text-secondary font-medium">83%</span>
                </div>
                <Meter value={83} tone="secondary" />
              </div>
            </div>
          </div>
        </section>

        {/* Visual Brand Showcase */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-16">
          <div className="card-surface overflow-hidden grid grid-cols-1 lg:grid-cols-12 items-center">
            <div className="lg:col-span-7 bg-[#0B0D14]">
              <img
                src="/og-aroha.jpg"
                alt="AROHA — Your Personal Evolution System"
                className="w-full h-full object-cover aspect-[16/9]"
              />
            </div>
            <div className="lg:col-span-5 p-6 sm:p-8 space-y-4">
              <p className="text-xs uppercase tracking-[0.14em] text-primary font-medium">
                Zero-Friction Execution
              </p>
              <h2 className="text-2xl font-bold leading-snug">
                Built for Mobile &amp; Desktop
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Install AROHA directly onto your mobile home screen or use it seamlessly on desktop with timely reminders and reliable sync.
              </p>
              <div className="flex flex-wrap gap-2.5 pt-1">
                {firebaseUser ? (
                  <Button onClick={handleAction} size="sm">
                    Open Dashboard
                  </Button>
                ) : (
                  <Button asChild size="sm">
                    <Link to="/signup">Get Started</Link>
                  </Button>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* System Capabilities Grid */}
        <section id="system" className="border-t border-border/70 bg-surface/35 py-16">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-8">
            <div className="max-w-2xl space-y-2">
              <h2 className="text-2xl sm:text-3xl font-bold">Core Capabilities. Zero Noise.</h2>
              <p className="text-sm sm:text-base text-muted-foreground">
                Your daily schedule, habits, focus sessions, and recovery unified in one calm workspace.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                {
                  icon: CalendarClock,
                  title: 'Time Blocking',
                  desc: 'Plan your day hour by hour with priorities and reusable schedule templates.',
                },
                {
                  icon: CheckSquare,
                  title: 'Habit Streaks',
                  desc: 'Build lasting consistency across daily, weekly, and monthly routines.',
                },
                {
                  icon: Timer,
                  title: 'Deep Focus',
                  desc: 'Structured focus timers and distraction-free work sessions.',
                },
                {
                  icon: Bot,
                  title: 'Personal AI Coach',
                  desc: 'Actionable guidance tailored to your own goals, schedule, and reflections.',
                },
                {
                  icon: BarChart3,
                  title: 'Progress Insights',
                  desc: 'Clear weekly and monthly trends to measure consistency over time.',
                },
                {
                  icon: Shield,
                  title: 'Health & Recovery',
                  desc: 'Track hydration, sleep, and training alongside your mental focus.',
                },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.title} className="card-surface p-5 space-y-2.5">
                    <div className="h-9 w-9 rounded-xl bg-primary-soft text-primary flex items-center justify-center">
                      <Icon className="h-4 w-4" />
                    </div>
                    <h3 className="text-base font-semibold">{item.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Progression Ladder */}
        <section id="progression" className="max-w-6xl mx-auto px-4 sm:px-6 py-16 space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="space-y-2 max-w-xl">
              <h2 className="text-2xl sm:text-3xl font-bold flex items-center gap-2.5">
                <Flame className="h-6 w-6 text-primary" />
                Progression Ranks
              </h2>
              <p className="text-sm text-muted-foreground">
                Advance through ranks by staying consistent across your daily habits, focus sessions, and goals.
              </p>
            </div>
            <Button asChild variant="outline">
              <Link to="/features">Explore Features</Link>
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {RANK_LADDER.map((tier) => (
              <div key={tier.name} className="card-surface p-5 space-y-2">
                <span className="text-base font-semibold block">{tier.name}</span>
                <p className="text-xs text-muted-foreground leading-relaxed">{tier.directive}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border/70 py-6 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-2.5">
            <img src="/app-icon-192.png" alt="AROHA" className="h-5 w-5 rounded" />
            <span>AROHA Life OS</span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/aroha" className="hover:text-foreground">Overview</Link>
            <Link to="/features" className="hover:text-foreground">Features</Link>
            <Link to="/login" className="hover:text-foreground">Sign In</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
