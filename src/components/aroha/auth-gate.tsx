import React from 'react';
import { Link } from 'react-router-dom';
import { useWorkspace } from '@/context/WorkspaceContext';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { firebaseUser, authLoading, workspace, workspaceLoading, workspaceError, signInWithGoogle, refreshWorkspace } =
    useWorkspace();

  if (authLoading || (firebaseUser && workspaceLoading && !workspace)) {
    return (
      <div className="min-h-screen bg-background p-6 max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-9 w-28" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <Skeleton className="h-56" />
          <Skeleton className="h-56 md:col-span-2" />
        </div>
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  if (!firebaseUser) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="card-surface max-w-md w-full p-8 text-center space-y-5 rise">
          <img
            src="/app-icon-192.png"
            alt="AROHA"
            className="mx-auto h-14 w-14 rounded-2xl shadow-lg border border-border/70"
          />
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">Authentication Required</h1>
            <p className="text-sm text-muted-foreground">
              Sign in with Google or any verified mail account to access your AROHA Life OS command workspace.
            </p>
          </div>
          <div className="space-y-2.5">
            <Button asChild className="w-full h-11 glow-primary">
              <Link to="/login">Sign in with Email or Password</Link>
            </Button>
            <Button onClick={() => signInWithGoogle()} variant="outline" className="w-full h-11">
              Continue with Google
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            New to AROHA?{' '}
            <Link to="/signup" className="text-primary font-medium hover:underline">
              Create an account
            </Link>
          </p>
        </div>
      </div>
    );
  }

  if (!workspace && workspaceError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="card-surface max-w-md w-full p-7 text-center space-y-4">
          <h2 className="text-lg font-semibold">Workspace Sync Interrupted</h2>
          <p className="text-sm text-muted-foreground">{workspaceError}</p>
          <Button onClick={() => refreshWorkspace()} className="w-full">
            Retry Sync
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
