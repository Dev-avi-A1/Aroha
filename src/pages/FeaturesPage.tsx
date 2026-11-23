import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useWorkspace } from '@/context/WorkspaceContext';
import { usePageSEO } from '@/lib/seo';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { PWAInstallButton } from '@/components/aroha/pwa-controls';

const FEATURE_SECTIONS = [
  { num: '01', name: 'Authentication & Identity', detail: 'Sign in quickly with Google or any verified personal or work email account.' },
  { num: '02', name: 'Command Center Dashboard', detail: 'Live Discipline Score, daily briefing, wisdom quotes, active block countdown, and quick habit check-ins.' },
  { num: '03', name: 'Schedule & Time Blocking', detail: 'Full-day timeline with priority tiers, calendar navigation, and reusable schedule templates.' },
  { num: '04', name: 'Habit Streak Tracker', detail: 'Daily, weekly, and monthly cadences, target quantities, streak tracking, and visual history.' },
  { num: '05', name: 'Deep Focus Suite', detail: 'Pomodoro and open Stopwatch modes with audio cues and distraction-free session logging.' },
  { num: '06', name: 'Health & Recovery', detail: 'Daily hydration, sleep duration, and physical training tracking.' },
  { num: '07', name: 'Journal & Reflection', detail: 'Mood tagging, structured daily entries, and searchable reflection history.' },
  { num: '08', name: 'AROHA AI Coach', detail: 'Private tactical coaching informed by your daily goals, schedule, habits, and reflections.' },
  { num: '09', name: 'Analytics & Insights', detail: 'Weekly, monthly, and yearly discipline trends with priority completion insights.' },
  { num: '10', name: 'Progression & Badges', detail: 'Progress ranks and milestone achievements earned through consistent daily execution.' },
  { num: '11', name: 'Goals & Milestones', detail: 'Categorized long-term goals with milestone checklists and progress tracking.' },
  { num: '12', name: 'Learning & Flashcards', detail: 'Reading logs, study minutes, and active-recall flashcard decks.' },
  { num: '13', name: 'Reminders & Alerts', detail: 'Scheduled notifications, custom lead times, audio alerts, and snooze controls.' },
  { num: '14', name: 'Cloud Sync & Export', detail: 'Automatic sync across devices paired with personal data backup and export.' },
  { num: '15', name: 'Profile & Preferences', detail: 'Customizable profile, timezone alignment, audio/haptics preferences, and app installation.' },
];

export function FeaturesPage() {
  const { firebaseUser } = useWorkspace();

  usePageSEO({
    title: 'AROHA Features – 15 Tactical Modules for Discipline & Focus',
    description:
      'Explore all 15 integrated modules inside AROHA Life OS: time blocking, habit streaks, Pomodoro focus, health logs, AI coaching, and analytics.',
    path: '/features',
  });

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="sticky top-0 z-30 border-b border-border/80 bg-background/85 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
          <Link to="/" className="flex items-center gap-2.5 font-heading text-lg font-bold tracking-tight whitespace-nowrap shrink-0">
            <img src="/app-icon-192.png" alt="AROHA" className="h-8 w-8 rounded-lg" />
            <span>AROHA</span>
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-muted-foreground">
            <Link to="/aroha" className="hover:text-foreground whitespace-nowrap shrink-0">Overview</Link>
            <Link to="/features" className="text-foreground whitespace-nowrap shrink-0">Features</Link>
          </nav>
          <div className="shrink-0 flex items-center gap-2">
            <PWAInstallButton alwaysShowGuide />
            {firebaseUser ? (
              <Button asChild size="sm">
                <Link to="/home">Open Command</Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm">
                  <Link to="/login">Sign In</Link>
                </Button>
                <Button asChild size="sm">
                  <Link to="/signup">Create Account</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-12 space-y-10">
        <div className="space-y-3 rise">
          <Link to="/" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to AROHA
          </Link>
          <h1 className="text-3xl sm:text-4xl font-bold">Complete 15-Module System Index</h1>
          <p className="text-muted-foreground max-w-2xl">
            Every tactical capability inside AROHA Life OS is connected through a single discipline and progression engine.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {FEATURE_SECTIONS.map((feat) => (
            <div key={feat.num} className="card-surface p-5 space-y-1.5">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold">{feat.num}. {feat.name}</h2>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{feat.detail}</p>
            </div>
          ))}
        </div>

        <div className="card-surface p-6 space-y-3">
          <h2 className="text-lg font-semibold">Frequently Asked Questions</h2>
          <Accordion type="single" collapsible>
            <AccordionItem value="xp">
              <AccordionTrigger>How is the Discipline Score determined?</AccordionTrigger>
              <AccordionContent>
                Your Discipline Score reflects your daily progress across scheduled time blocks, habit check-ins, deep focus sessions, and recovery targets.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="templates">
              <AccordionTrigger>What happens on first launch?</AccordionTrigger>
              <AccordionContent>
                New accounts start with a curated starter schedule, foundational daily habits, and recovery targets that you can customize anytime.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="android">
              <AccordionTrigger>How do I install AROHA on mobile?</AccordionTrigger>
              <AccordionContent>
                Open AROHA in your mobile browser and tap Install App (or Add to Home screen) to launch it full-screen like a native app.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </main>

      <footer className="border-t border-border/70 py-6 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-2.5">
            <img src="/app-icon-192.png" alt="AROHA" className="h-5 w-5 rounded" />
            <span>AROHA Life OS</span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/aroha" className="hover:text-foreground">Overview</Link>
            <Link to="/" className="hover:text-foreground">Home</Link>
            <Link to="/login" className="hover:text-foreground">Sign In</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
