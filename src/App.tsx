import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from 'sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { WorkspaceProvider } from '@/context/WorkspaceContext';
import { OfflineIndicator } from '@/components/aroha/pwa-controls';
import { LandingPage } from '@/pages/LandingPage';
import { AuthPage } from '@/pages/AuthPage';
import { FeaturesPage } from '@/pages/FeaturesPage';
import { HomePage } from '@/pages/HomePage';
import { SchedulePage } from '@/pages/SchedulePage';
import { HabitsPage } from '@/pages/HabitsPage';
import { FocusPage } from '@/pages/FocusPage';
import { HealthPage } from '@/pages/HealthPage';
import { JournalPage } from '@/pages/JournalPage';
import { CoachPage } from '@/pages/CoachPage';
import { AnalyticsPage } from '@/pages/AnalyticsPage';
import { GoalsPage } from '@/pages/GoalsPage';
import { LearnPage } from '@/pages/LearnPage';
import { LevelPage } from '@/pages/LevelPage';
import { AchievementsPage } from '@/pages/AchievementsPage';
import { RemindersPage } from '@/pages/RemindersPage';
import { SyncPage } from '@/pages/SyncPage';
import { ProfileEditPage, ProfilePage } from '@/pages/ProfilePage';
import { SettingsPage } from '@/pages/SettingsPage';

export default function App() {
  return (
    <TooltipProvider>
      <WorkspaceProvider>
        <BrowserRouter>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/aroha" element={<LandingPage canonical />} />
            <Route path="/ascend" element={<Navigate to="/aroha" replace />} />
            <Route path="/features" element={<FeaturesPage />} />
            <Route path="/login" element={<AuthPage mode="login" />} />
            <Route path="/signup" element={<AuthPage mode="signup" />} />
            <Route path="/signin" element={<Navigate to="/login" replace />} />
            <Route path="/register" element={<Navigate to="/signup" replace />} />

            {/* Authenticated Life OS Routes */}
            <Route path="/home" element={<HomePage />} />
            <Route path="/schedule" element={<SchedulePage />} />
            <Route path="/time-blocking-app" element={<SchedulePage />} />
            <Route path="/habits" element={<HabitsPage />} />
            <Route path="/habit-tracker" element={<HabitsPage />} />
            <Route path="/focus" element={<FocusPage />} />
            <Route path="/health" element={<HealthPage />} />
            <Route path="/journal" element={<JournalPage />} />
            <Route path="/coach" element={<CoachPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/goals" element={<GoalsPage />} />
            <Route path="/learn" element={<LearnPage />} />
            <Route path="/level" element={<LevelPage />} />
            <Route path="/achievements" element={<AchievementsPage />} />
            <Route path="/notifications" element={<RemindersPage />} />
            <Route path="/reminders" element={<RemindersPage />} />
            <Route path="/sync" element={<SyncPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/profile/edit" element={<ProfileEditPage />} />
            <Route path="/settings" element={<SettingsPage />} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
        <OfflineIndicator />
        <Toaster
          theme="dark"
          position="top-right"
          toastOptions={{
            style: {
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              color: 'var(--foreground)',
            },
          }}
        />
      </WorkspaceProvider>
    </TooltipProvider>
  );
}
