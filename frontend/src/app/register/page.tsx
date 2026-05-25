import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Lock } from 'lucide-react';
import { getServerSupabase } from '@/lib/supabase/server';
import { RegisterForm } from './RegisterForm';
import { REFERRAL_CODE_REGEX, ROUTES } from '@/lib/constants';
import { PageLayout } from '@/components/layout/PageLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata = {
  title: 'Sign up — soccer-pool 2026',
};

type Phase = 'phase1' | 'phase1_locked' | 'phase2_open' | 'phase2_locked';

// Mirrors /api/tournament/route.ts:76-86. New registrations are only
// allowed in phase1: once group picks freeze, a new account can't
// produce a complete prediction (no group/champion picks possible).
async function fetchRegistrationPhase(): Promise<Phase | null> {
  const supabase = await getServerSupabase();
  const { data } = await supabase
    .from('tournaments')
    .select('lock_time, knockout_unlocked, knockout_lock_time')
    .eq('is_active', true)
    .maybeSingle();
  if (!data) return null;

  const now = Date.now();
  const lockMs = new Date(data.lock_time).getTime();
  const knockoutLockMs = data.knockout_lock_time
    ? new Date(data.knockout_lock_time).getTime()
    : null;
  if (now < lockMs) return 'phase1';
  if (data.knockout_unlocked && (knockoutLockMs === null || now < knockoutLockMs))
    return 'phase2_open';
  if (data.knockout_unlocked) return 'phase2_locked';
  return 'phase1_locked';
}

// Next.js 16 — searchParams is a Promise.
export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string | string[] }>;
}) {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect(ROUTES.predictions);

  const phase = await fetchRegistrationPhase();
  const registrationOpen = phase === null || phase === 'phase1';

  const params = await searchParams;
  const rawRef = Array.isArray(params.ref) ? params.ref[0] : params.ref;
  // Normalize and apply a light client-side format check so we don't echo
  // arbitrary query strings into the form. The server RPC is the real check.
  const normalized = rawRef?.trim().toUpperCase();
  const initialReferralCode =
    normalized && REFERRAL_CODE_REGEX.test(normalized) ? normalized : undefined;

  return (
    <PageLayout>
      <div className="mx-auto max-w-md py-12">
        <Card>
          <CardHeader>
            <CardTitle>{registrationOpen ? 'Create an account' : 'Registration closed'}</CardTitle>
            <CardDescription>
              {registrationOpen
                ? 'Pick a username, enter your email and a password.'
                : 'The tournament is already underway, so new sign-ups are paused.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {registrationOpen ? (
              <RegisterForm initialReferralCode={initialReferralCode} />
            ) : (
              <div className="space-y-4">
                <div
                  role="status"
                  className="bg-destructive/10 text-destructive flex items-start gap-3 rounded-md border border-destructive/30 px-3 py-3 text-sm"
                >
                  <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  <p>
                    Group-stage picks have locked, so new accounts can&apos;t produce a
                    complete prediction this tournament. Registration will reopen for the next
                    pool.
                  </p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button asChild variant="outline" className="w-full sm:flex-1">
                    <Link href={ROUTES.leaderboard}>View leaderboard</Link>
                  </Button>
                  <Button asChild className="w-full sm:flex-1">
                    <Link href={ROUTES.login}>Sign in</Link>
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  );
}
