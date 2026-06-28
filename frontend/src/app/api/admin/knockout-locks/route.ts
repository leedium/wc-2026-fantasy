import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin, isAdminGateError } from '@/lib/auth/requireAdmin';
import { safeMessage } from '@/lib/api/errors';

/**
 * List the per-fixture knockout locks for a tournament. Admin-gated read used by
 * the knockout admin editor to show each fixture's lock state. (The user-facing
 * wizard reads the same locks via the public /api/tournament route.)
 */
export async function GET(request: NextRequest) {
  const ctx = await requireAdmin();
  if (isAdminGateError(ctx)) return ctx.response;

  const { searchParams } = new URL(request.url);
  const tournamentId = searchParams.get('tournamentId');
  if (!tournamentId) {
    return NextResponse.json({ error: 'tournamentId is required' }, { status: 400 });
  }

  const { data, error } = await ctx.supabase
    .from('knockout_match_locks')
    .select('match_id, locked_at')
    .eq('tournament_id', tournamentId);

  if (error) return NextResponse.json({ error: safeMessage(error) }, { status: 500 });

  const locks = ((data ?? []) as { match_id: string; locked_at: string }[]).map((l) => ({
    matchId: l.match_id,
    lockedAt: l.locked_at,
  }));
  return NextResponse.json(locks);
}
