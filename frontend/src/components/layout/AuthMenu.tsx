'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Gift, LogOut, Settings, Shield, Trophy, User as UserIcon } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useAuth } from '@/hooks/useAuth';
import { useMounted } from '@/hooks/useMounted';
import { useRewardsStatus } from '@/hooks/useRewardsStatus';
import { ROUTES } from '@/lib/constants';
import { cn } from '@/lib/utils';

export function AuthMenu() {
  const { user, profile, signOut } = useAuth();
  const router = useRouter();
  const mounted = useMounted();
  const [isSigningOut, setIsSigningOut] = React.useState(false);
  const { status: rewardsStatus } = useRewardsStatus();
  const credits = rewardsStatus.totalAvailable;

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      // If GoTrue's lock wedges, fall back to a hard reload to /login so the
      // button never gets stuck in 'Signing out…' (see supabase/auth-js#762).
      const timeout = new Promise<'timeout'>((resolve) =>
        setTimeout(() => resolve('timeout'), 5000)
      );
      const result = await Promise.race([signOut().then(() => 'ok' as const), timeout]);
      if (result === 'timeout') {
        window.location.href = ROUTES.login;
        return;
      }
      toast.success('Signed out');
      router.push(ROUTES.home);
      router.refresh();
    } catch {
      toast.error('Failed to sign out');
    } finally {
      setIsSigningOut(false);
    }
  };

  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href={ROUTES.login}>Sign in</Link>
        </Button>
        <Button size="sm" asChild>
          <Link href={ROUTES.register}>Sign up</Link>
        </Button>
      </div>
    );
  }

  const displayName = profile?.displayName || user.email || profile?.username;

  // Defer the Radix Popover until after hydration. Radix uses useId()
  // internally, and its IDs shift between SSR and client when other
  // mount-gated components (ThemeToggle, etc.) re-render — producing a
  // confusing aria-controls hydration mismatch. Rendering a plain
  // (non-Radix) placeholder for the first paint sidesteps the issue.
  if (!mounted) {
    return (
      <Button variant="outline" size="sm" className="gap-2" disabled>
        <UserIcon className="h-4 w-4" />
        <span className="max-w-[120px] truncate">{displayName}</span>
      </Button>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="relative gap-2">
          <UserIcon className="h-4 w-4" />
          <span className="max-w-[120px] truncate">{displayName}</span>
          {/* Unread-style indicator for available free-pick credits
              (any source). aria-hidden because the popover content
              surfaces the count for screen readers — this dot is purely
              a visual hint. */}
          {credits > 0 && (
            <span
              aria-hidden
              className={cn(
                'absolute -top-1 -right-1 inline-flex h-2.5 w-2.5 rounded-full',
                'bg-green-500 ring-2 ring-background'
              )}
            />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-60">
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium">{profile?.username ?? 'Account'}</p>
            <p className="text-muted-foreground truncate text-xs">{user.email}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start gap-2"
            asChild
          >
            <Link href={ROUTES.rewards}>
              <Trophy className="h-4 w-4" />
              <span className="flex-1 text-left">Rewards</span>
              {credits > 0 && (
                <span
                  className={cn(
                    'inline-flex min-w-[1.25rem] items-center justify-center rounded-full',
                    'bg-green-600 px-1.5 py-0.5 text-xs font-semibold text-white'
                  )}
                  aria-label={`${credits} free pick credits available`}
                >
                  {credits}
                </span>
              )}
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start gap-2"
            asChild
          >
            <Link href={ROUTES.referrals}>
              <Gift className="h-4 w-4" />
              <span className="flex-1 text-left">Refer a friend</span>
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start gap-2"
            asChild
          >
            <Link href={ROUTES.account}>
              <Settings className="h-4 w-4" />
              Account settings
            </Link>
          </Button>
          {profile?.isAdmin && (
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start gap-2"
              asChild
            >
              <Link href={ROUTES.admin}>
                <Shield className="h-4 w-4" />
                Admin
              </Link>
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start gap-2"
            onClick={handleSignOut}
            disabled={isSigningOut}
          >
            <LogOut className="h-4 w-4" />
            {isSigningOut ? 'Signing out…' : 'Sign out'}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
