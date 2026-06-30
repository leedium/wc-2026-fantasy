import { getServerSupabase } from '@/lib/supabase/server';

type Phase = 'phase1' | 'phase1_locked' | 'phase2_open' | 'phase2_locked';

// Server-side tournament lock check. Mirrors the phase computation in
// /api/tournament/route.ts (and public.tournament_phase) using the DB clock
// (select_now) so it isn't fooled by request-host skew. Returns false when
// there's no active tournament (don't block in that edge case).
export async function isTournamentLocked(): Promise<boolean> {
  const supabase = await getServerSupabase();
  const [tRes, nowRes] = await Promise.all([
    supabase
      .from('tournaments')
      .select('lock_time, knockout_unlocked, knockout_lock_time')
      .eq('is_active', true)
      .maybeSingle(),
    supabase.rpc('select_now'),
  ]);

  const data = tRes.data as {
    lock_time: string;
    knockout_unlocked: boolean;
    knockout_lock_time: string | null;
  } | null;
  if (!data) return false;

  const now = (typeof nowRes.data === 'string' ? new Date(nowRes.data) : new Date()).getTime();
  const lockMs = new Date(data.lock_time).getTime();
  const knockoutLockMs = data.knockout_lock_time
    ? new Date(data.knockout_lock_time).getTime()
    : null;

  let phase: Phase;
  if (now < lockMs) phase = 'phase1';
  else if (data.knockout_unlocked && (knockoutLockMs === null || now < knockoutLockMs))
    phase = 'phase2_open';
  else if (data.knockout_unlocked) phase = 'phase2_locked';
  else phase = 'phase1_locked';

  return phase === 'phase1_locked' || phase === 'phase2_locked';
}

async function isSuperAdminServer(userId: string): Promise<boolean> {
  const supabase = await getServerSupabase();
  const { data } = await supabase
    .from('profiles')
    .select('is_super_admin')
    .eq('id', userId)
    .maybeSingle();
  return (data as { is_super_admin?: boolean } | null)?.is_super_admin === true;
}

// True when a user-facing prediction page (/predictions/new, /predictions/[id])
// should redirect to /predictions: the tournament is locked and the user is not
// a super admin. Super admins keep direct access (they edit via these pages /
// the admin editor in any phase).
export async function shouldRedirectLockedPrediction(userId: string): Promise<boolean> {
  const [locked, superAdmin] = await Promise.all([
    isTournamentLocked(),
    isSuperAdminServer(userId),
  ]);
  return locked && !superAdmin;
}
