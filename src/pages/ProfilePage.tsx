import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Edit3, LogOut, Settings, Shield, Trophy } from 'lucide-react';
import { useWorkspace } from '@/context/WorkspaceContext';
import { AppShell } from '@/components/aroha/app-shell';
import { Meter, PageHeading, SectionHeader, StatTile } from '@/components/aroha/primitives';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

const TIMEZONES = [
  'UTC',
  'America/Los_Angeles',
  'America/Denver',
  'America/Chicago',
  'America/New_York',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Asia/Singapore',
  'Asia/Kolkata',
  'Australia/Sydney',
];

export function ProfilePage() {
  const { workspace, signOutUser } = useWorkspace();
  const navigate = useNavigate();

  if (!workspace) {
    return (
      <AppShell title="Profile">
        <div className="card-surface p-6 text-sm text-muted-foreground">Loading profile...</div>
      </AppShell>
    );
  }

  const initials = (workspace.user.displayName || 'AR')
    .split(' ')
    .map((p) => p[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const unlockedBadges = workspace.achievements.filter((a) => a.unlocked).length;

  return (
    <AppShell
      title="Operator Profile"
      headerAction={
        <Button asChild size="sm" variant="outline">
          <Link to="/profile/edit">
            <Edit3 className="h-3.5 w-3.5" /> Edit
          </Link>
        </Button>
      }
    >
      <PageHeading title="Operator Profile" subtitle="Identity, rank status, and system alignment" />

      <div className="card-surface p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
        <div className="flex items-center gap-4 min-w-0">
          <Avatar className="h-16 w-16">
            {workspace.user.avatarUrl && <AvatarImage src={workspace.user.avatarUrl} alt={workspace.user.displayName} />}
            <AvatarFallback className="text-lg">{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 space-y-1">
            <h2 className="text-xl font-bold truncate">{workspace.user.displayName}</h2>
            <p className="text-xs text-muted-foreground truncate">
              @{workspace.user.handle} · {workspace.user.email} · {workspace.user.timezone}
            </p>
            <p className="text-sm text-muted-foreground pt-1">{workspace.user.bio}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Button asChild variant="outline" size="sm">
            <Link to="/profile/edit">Edit Profile</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/settings">
              <Settings className="h-3.5 w-3.5" /> Settings
            </Link>
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={async () => {
              await signOutUser();
              navigate('/');
            }}
          >
            <LogOut className="h-3.5 w-3.5" /> Sign Out
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile label="Rank" value={workspace.xp.rank} tone="primary" icon={Shield} />
        <StatTile label="Level" value={workspace.xp.level} tone="success" />
        <StatTile label="Total XP" value={workspace.xp.totalXp} suffix="XP" tone="warning" />
        <StatTile label="Badges" value={`${unlockedBadges}/${workspace.achievements.length}`} tone="default" icon={Trophy} />
      </div>

      <div className="card-surface p-6 space-y-3">
        <SectionHeader
          title={`Level ${workspace.xp.level} Progression`}
          action={<Link to="/level" className="text-xs text-primary hover:underline">Full Breakdown</Link>}
        />
        <Meter value={workspace.xp.progressPercent} max={100} tone="primary" />
        <p className="text-xs text-muted-foreground num">
          {workspace.xp.currentLevelXp} / {workspace.xp.nextLevelXp} XP toward Level {workspace.xp.level + 1}
        </p>
      </div>
    </AppShell>
  );
}

export function ProfileEditPage() {
  const { workspace, updateProfile } = useWorkspace();
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState(workspace?.user.displayName ?? '');
  const [handle, setHandle] = useState(workspace?.user.handle ?? '');
  const [bio, setBio] = useState(workspace?.user.bio ?? '');
  const [timezone, setTimezone] = useState(workspace?.user.timezone ?? 'UTC');
  const [avatarUrl, setAvatarUrl] = useState(workspace?.user.avatarUrl ?? '');
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (workspace?.user) {
      setDisplayName(workspace.user.displayName);
      setHandle(workspace.user.handle);
      setBio(workspace.user.bio);
      setTimezone(workspace.user.timezone);
      setAvatarUrl(workspace.user.avatarUrl);
    }
  }, [workspace?.user]);

  if (!workspace) {
    return (
      <AppShell title="Edit Profile">
        <div className="card-surface p-6 text-sm text-muted-foreground">Loading...</div>
      </AppShell>
    );
  }

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type)) {
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string' && reader.result.length < 140000) {
        setAvatarUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateProfile({
        displayName: displayName.trim() || 'Operator',
        handle: handle.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '') || 'operator',
        bio: bio.trim(),
        timezone,
        avatarUrl,
      });
      navigate('/profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell title="Edit Profile">
      <PageHeading title="Edit Profile" subtitle="Update handle, bio, avatar, and timezone alignment" />

      <form onSubmit={handleSubmit} className="card-surface p-6 max-w-2xl space-y-5">
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16">
            {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName} />}
            <AvatarFallback>{displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground block">Avatar Image (PNG/JPG/WebP under 100KB)</label>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={handleAvatarUpload}
              className="text-xs text-muted-foreground file:mr-3 file:rounded-lg file:border file:border-border file:bg-surface file:px-3 file:py-1.5 file:text-xs file:text-foreground cursor-pointer"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Display Name</label>
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Operator Handle</label>
            <Input value={handle} onChange={(e) => setHandle(e.target.value)} required />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Timezone (Clock & Greeting Alignment)</label>
          <Select value={timezone} onValueChange={setTimezone}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIMEZONES.map((tz) => (
                <SelectItem key={tz} value={tz}>
                  {tz}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Bio / Directive</label>
          <Textarea value={bio} onChange={(e) => setBio(e.target.value)} />
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => navigate('/profile')}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving...' : 'Save Profile'}
          </Button>
        </div>
      </form>
    </AppShell>
  );
}
