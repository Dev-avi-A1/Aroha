import React, { useEffect, useRef, useState } from 'react';
import { Bell, BellOff, BellRing } from 'lucide-react';
import { toast } from 'sonner';
import { useWorkspace } from '@/context/WorkspaceContext';
import { formatTimeInTimezone } from '@/lib/utils';
import { timeToMinutes } from '@/lib/presets';
import { playTacticalChime, speakTacticalVoice } from '@/lib/audio';
import { Button } from '@/components/ui/button';

export function NotificationScheduler() {
  const { workspace } = useWorkspace();
  const firedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!workspace || !workspace.user.notificationsEnabled) return;

    const checkScheduleAlerts = () => {
      const nowClock = formatTimeInTimezone(workspace.user.timezone);
      const nowMins = timeToMinutes(nowClock);
      const lead = workspace.user.leadTimeMinutes;
      const dayShort = new Intl.DateTimeFormat('en-US', {
        timeZone: workspace.user.timezone || 'UTC',
        weekday: 'short',
      }).format(new Date());

      const notifyUser = (
        key: string,
        title: string,
        body: string,
        voice: boolean,
        targetUrl = '/home'
      ) => {
        if (firedRef.current.has(key)) return;
        firedRef.current.add(key);

        playTacticalChime('alert', workspace.user.soundEnabled, workspace.user.soundVolume);
        if (voice || workspace.user.voiceRemindersEnabled) {
          speakTacticalVoice(`${title}. ${body}`, true);
        }
        toast.info(`${title} — ${body}`);

        if ('Notification' in window && Notification.permission === 'granted') {
          if ('serviceWorker' in navigator) {
            navigator.serviceWorker.ready
              .then((reg) =>
                reg.showNotification(title, {
                  body,
                  icon: '/app-icon-192.png',
                  badge: '/favicon.png',
                  tag: key,
                  data: { url: targetUrl },
                })
              )
              .catch(() => {
                try {
                  new Notification(title, { body, icon: '/app-icon-192.png' });
                } catch {
                  // Fallback handled by toast
                }
              });
          } else {
            try {
              new Notification(title, { body, icon: '/app-icon-192.png' });
            } catch {
              // Fallback handled by toast
            }
          }
        }
      };

      // Check upcoming today time blocks
      for (const block of workspace.scheduleBlocks) {
        if (block.date !== workspace.today || block.completed) continue;
        const startMins = timeToMinutes(block.startTime);
        const diff = startMins - nowMins;
        if (diff >= 0 && diff <= lead) {
          notifyUser(
            `block-${block.id}-${workspace.today}`,
            `Block in ${diff === 0 ? 'now' : `${diff}m`}`,
            `${block.title} (${block.startTime})`,
            false,
            '/schedule'
          );
        }
      }

      // Check custom reminders
      for (const rem of workspace.reminders) {
        if (!rem.enabled) continue;
        if (rem.snoozedUntil && new Date(rem.snoozedUntil).getTime() > Date.now()) continue;
        let days: string[] = [];
        try {
          days = JSON.parse(rem.daysJson) as string[];
        } catch {
          days = [];
        }
        if (days.length > 0 && !days.includes(dayShort)) continue;
        if (rem.time === nowClock) {
          notifyUser(
            `rem-${rem.id}-${workspace.today}-${rem.time}`,
            rem.title,
            `Scheduled alert (${rem.time})`,
            rem.voiceAlert,
            '/reminders'
          );
        }
      }
    };

    checkScheduleAlerts();
    const timer = window.setInterval(checkScheduleAlerts, 30000);
    return () => window.clearInterval(timer);
  }, [workspace]);

  return null;
}

export function NotificationPermissionCard() {
  const { workspace, updateProfile } = useWorkspace();
  const supported = typeof window !== 'undefined' && 'Notification' in window;
  const [permission, setPermission] = useState<NotificationPermission>(
    supported ? Notification.permission : 'denied'
  );

  const requestPerm = async () => {
    if (!supported) {
      toast.error('Web Notifications are not supported in this browser.');
      return;
    }
    const res = await Notification.requestPermission();
    setPermission(res);
    if (res === 'granted') {
      await updateProfile({ notificationsEnabled: true });
      toast.success('Browser push notifications enabled.');
    } else {
      toast.warning('Permission denied. In-app tactical alerts remain active.');
    }
  };

  return (
    <div className="card-surface p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary-soft flex items-center justify-center text-primary shrink-0">
          {permission === 'granted' ? <BellRing className="h-5 w-5" /> : permission === 'denied' ? <BellOff className="h-5 w-5" /> : <Bell className="h-5 w-5" />}
        </div>
        <div className="space-y-1">
          <h3 className="text-sm font-semibold">Web Push & Block Lead Alerts</h3>
          <p className="text-xs text-muted-foreground">
            Status: <span className="capitalize text-foreground font-medium">{supported ? permission : 'unsupported'}</span>
            {' · '}Lead time <span className="num">{workspace?.user.leadTimeMinutes ?? 10}m</span> before blocks
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {permission !== 'granted' && supported && (
          <Button size="sm" onClick={requestPerm}>
            Enable Push Alerts
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            playTacticalChime('alert', workspace?.user.soundEnabled, workspace?.user.soundVolume);
            if (workspace?.user.voiceRemindersEnabled) {
              speakTacticalVoice('AROHA protocol test alert. Stay locked on the next block.', true);
            }
            toast.success('Test tactical alert dispatched.');
          }}
        >
          Test Alert
        </Button>
      </div>
    </div>
  );
}
