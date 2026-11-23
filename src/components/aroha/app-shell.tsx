import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Activity,
  Award,
  BarChart3,
  Bell,
  BookOpen,
  Bot,
  CalendarClock,
  CheckSquare,
  Cloud,
  Flame,
  Home,
  Menu,
  NotebookPen,
  Search,
  Settings,
  Shield,
  Target,
  Timer,
  Trophy,
  User,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWorkspace } from '@/context/WorkspaceContext';
import { AuthGate } from './auth-gate';
import { NotificationScheduler } from './notification-scheduler';
import { PWAInstallButton } from './pwa-controls';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const CORE_TABS = [
  { to: '/home', label: 'Home', icon: Home },
  { to: '/schedule', label: 'Schedule', icon: CalendarClock },
  { to: '/focus', label: 'Focus', icon: Timer },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/profile', label: 'Profile', icon: User },
];

const DRAWER_LINKS = [
  { to: '/goals', label: 'Goals', icon: Target },
  { to: '/habits', label: 'Habits', icon: CheckSquare },
  { to: '/coach', label: 'AROHA AI', icon: Bot },
  { to: '/journal', label: 'Journal', icon: NotebookPen },
  { to: '/learn', label: 'Learn', icon: BookOpen },
  { to: '/health', label: 'Health', icon: Activity },
  { to: '/level', label: 'Level', icon: Flame },
  { to: '/achievements', label: 'Achievements', icon: Trophy },
  { to: '/reminders', label: 'Reminders', icon: Bell },
  { to: '/sync', label: 'Sync', icon: Cloud },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export function AppShell({
  title,
  headerAction,
  children,
}: {
  title: string;
  headerAction?: React.ReactNode;
  children: React.ReactNode;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const { workspace, updateProfile } = useWorkspace();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const initials = (workspace?.user.displayName || 'AR')
    .split(' ')
    .map((p) => p[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <AuthGate>
      <NotificationScheduler />
      <div className="min-h-screen bg-background text-foreground flex">
        {/* Adaptive Desktop Sidebar */}
        <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 border-r border-sidebar-border bg-sidebar">
          <div className="flex h-16 items-center justify-between px-5 border-b border-sidebar-border">
            <Link to="/home" className="flex items-center gap-2.5 font-heading text-lg font-bold tracking-tight text-foreground">
              <img src="/app-icon-192.png" alt="AROHA" className="h-7 w-7 rounded-lg" />
              <span>AROHA</span>
            </Link>
            <span className="num text-xs text-primary font-semibold">
              Lv.{workspace?.xp.level ?? 1}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
            <div className="space-y-1">
              <p className="px-3 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground mb-2">
                Core Operations
              </p>
              {CORE_TABS.map((item) => {
                const Icon = item.icon;
                const active = location.pathname === item.to || (item.to === '/schedule' && location.pathname === '/time-blocking-app');
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={cn(
                      'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap',
                      active
                        ? 'bg-primary-soft text-primary'
                        : 'text-muted-foreground hover:bg-sidebar-accent hover:text-foreground'
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>

            <div className="space-y-1">
              <p className="px-3 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground mb-2">
                Modules
              </p>
              {DRAWER_LINKS.map((item) => {
                const Icon = item.icon;
                const active =
                  location.pathname === item.to ||
                  (item.to === '/habits' && location.pathname === '/habit-tracker') ||
                  (item.to === '/reminders' && location.pathname === '/notifications');
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={cn(
                      'flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap',
                      active
                        ? 'bg-primary-soft text-primary'
                        : 'text-muted-foreground hover:bg-sidebar-accent hover:text-foreground'
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="p-4 border-t border-sidebar-border space-y-3">
            <PWAInstallButton className="w-full justify-center" />
            <button
              type="button"
              onClick={() => setCommandOpen(true)}
              className="w-full flex items-center justify-between rounded-xl border border-border bg-background/60 px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Search className="h-3.5 w-3.5" />
                Quick Jump
              </span>
              <kbd className="num text-[11px] text-muted-foreground">Ctrl+K</kbd>
            </button>
            <Link
              to="/profile"
              className="flex items-center gap-3 rounded-xl p-1.5 hover:bg-sidebar-accent transition-colors"
            >
              <Avatar className="h-9 w-9">
                {workspace?.user.avatarUrl && <AvatarImage src={workspace.user.avatarUrl} alt={workspace.user.displayName} />}
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{workspace?.user.displayName || 'Operator'}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {workspace?.xp.rank || 'Novice'} · <span className="num">{workspace?.xp.totalXp ?? 0} XP</span>
                </p>
              </div>
            </Link>
          </div>
        </aside>

        {/* Main Viewport */}
        <div className="flex-1 flex flex-col min-w-0 lg:pl-64 pb-20 lg:pb-8">
          {/* Sticky Glass Header */}
          <header className="sticky top-0 z-30 h-14 border-b border-border/80 bg-background/85 backdrop-blur-xl px-4 sm:px-6 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
                <SheetTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="lg:hidden h-10 w-10 shrink-0"
                    aria-label="Open navigation menu"
                  >
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-80 bg-sidebar border-sidebar-border">
                  <SheetHeader className="pb-4 border-b border-sidebar-border">
                    <SheetTitle className="font-heading text-lg font-bold flex items-center justify-between pr-6">
                      <span className="flex items-center gap-2.5">
                        <img src="/app-icon-192.png" alt="AROHA" className="h-6 w-6 rounded-md" />
                        <span>AROHA</span>
                      </span>
                      <span className="num text-xs text-primary font-semibold">
                        {workspace?.xp.rank ?? 'Novice'} · Lv.{workspace?.xp.level ?? 1}
                      </span>
                    </SheetTitle>
                  </SheetHeader>
                  <div className="mt-4 space-y-1">
                    {DRAWER_LINKS.map((item) => {
                      const Icon = item.icon;
                      const active = location.pathname === item.to;
                      return (
                        <Link
                          key={item.to}
                          to={item.to}
                          onClick={() => setDrawerOpen(false)}
                          className={cn(
                            'flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors',
                            active
                              ? 'bg-primary-soft text-primary'
                              : 'text-muted-foreground hover:bg-sidebar-accent hover:text-foreground'
                          )}
                        >
                          <Icon className="h-4 w-4 shrink-0" />
                          <span>{item.label}</span>
                        </Link>
                      );
                    })}
                    <div className="pt-3">
                      <PWAInstallButton className="w-full justify-center" />
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
              <span className="font-heading text-base font-semibold truncate">{title}</span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {workspace?.user.focusModeEnabled && (
                <button
                  type="button"
                  onClick={() => updateProfile({ focusModeEnabled: false })}
                  className="hidden sm:inline-flex items-center gap-1.5 rounded-lg bg-primary-soft px-2.5 py-1 text-xs font-medium text-primary cursor-pointer"
                >
                  <Shield className="h-3.5 w-3.5" />
                  Deep Focus Active
                </button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden h-10 w-10"
                onClick={() => setCommandOpen(true)}
                aria-label="Open quick search"
              >
                <Search className="h-4 w-4" />
              </Button>
              {headerAction}
            </div>
          </header>

          {/* Content Container */}
          <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
            {children}
          </main>
        </div>

        {/* Mobile Fixed Bottom Dock (5 Core Tabs, <= 15% height) */}
        <nav
          aria-label="Primary bottom navigation"
          className="lg:hidden fixed bottom-0 left-0 right-0 z-40 min-h-16 pb-[env(safe-area-inset-bottom)] border-t border-border bg-surface/92 backdrop-blur-xl grid grid-cols-5 items-center px-1"
        >
          {CORE_TABS.map((item) => {
            const Icon = item.icon;
            const active =
              location.pathname === item.to ||
              (item.to === '/schedule' && location.pathname === '/time-blocking-app');
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  'flex flex-col items-center justify-center gap-1 h-12 rounded-xl transition-colors whitespace-nowrap',
                  active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="text-[11px] font-medium leading-none">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Global Ctrl+K Command Palette */}
        <CommandDialog open={commandOpen} onOpenChange={setCommandOpen}>
          <CommandInput placeholder="Jump to any AROHA module or action..." />
          <CommandList>
            <CommandEmpty>No matching module found.</CommandEmpty>
            <CommandGroup heading="Core Views">
              {CORE_TABS.map((item) => {
                const Icon = item.icon;
                return (
                  <CommandItem
                    key={item.to}
                    onSelect={() => {
                      setCommandOpen(false);
                      navigate(item.to);
                    }}
                  >
                    <Icon className="h-4 w-4 text-primary" />
                    <span>{item.label}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
            <CommandGroup heading="System Modules">
              {DRAWER_LINKS.map((item) => {
                const Icon = item.icon;
                return (
                  <CommandItem
                    key={item.to}
                    onSelect={() => {
                      setCommandOpen(false);
                      navigate(item.to);
                    }}
                  >
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span>{item.label}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
            <CommandGroup heading="Quick Actions">
              <CommandItem
                onSelect={() => {
                  setCommandOpen(false);
                  updateProfile({ focusModeEnabled: !workspace?.user.focusModeEnabled });
                }}
              >
                <Award className="h-4 w-4 text-warning" />
                <span>
                  {workspace?.user.focusModeEnabled ? 'Disable Deep Focus Mode' : 'Enable Deep Focus Mode'}
                </span>
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </CommandDialog>
      </div>
    </AuthGate>
  );
}
