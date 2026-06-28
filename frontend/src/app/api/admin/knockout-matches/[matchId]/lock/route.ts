import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin, isAdminGateError } from '@/lib/auth/requireAdmin';
import { safeMessage } from '@/lib/api/errors';

type RouteContext = { params: Promise<{ matchId: string }> };

/**
 * Set (or clear) the per-fixture knockout lock for a match.
 *
 * Body `{ tournamentId, lockedAt }`:
 *   - lockedAt: ISO timestamp → the fixture locks (becomes uneditable) at that
 *     time. Admins set it to the fixture's kickoff in advance, or to now() to
 *     lock immediately.
 *   - lockedAt: null → unlock (the "unlock" half of unlock → edit → re-lock).
 *
 * Calls admin_set_knockout_match_lock (migration 0072).
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const ctx = await requireAdmin();
  if (isAdminGateError(ctx)) return ctx.response;
  const { matchId } = await context.params;

  const body = (await request.json()) as {
    tournamentId?: string;
    lockedAt?: string | null;
  };

  if (!body.tournamentId) {
    return NextResponse.json({ error: 'tournamentId is required' }, { status: 400 });
  }
  if (body.lockedAt === undefined) {
    return NextResponse.json(
      { error: 'lockedAt is required (ISO timestamp, or null to unlock)' },
      { status: 400 }
    );
  }

  let lockedAt: string | null = null;
  if (body.lockedAt !== null) {
    const parsed = new Date(body.lockedAt);
    if (Number.isNaN(parsed.getTime())) {
      return NextResponse.json(
        { error: 'lockedAt must be a valid ISO timestamp or null' },
        { status: 400 }
      );
    }
    lockedAt = parsed.toISOString();
  }

  const { error } = await ctx.supabase.rpc('admin_set_knockout_match_lock', {
    p_tournament_id: body.tournamentId,
    p_match_id: matchId,
    p_locked_at: lockedAt,
  });

  if (error) {
    const msg = (error.message ?? '').toLowerCase();
    const status = msg.includes('forbidden') ? 403 : msg.includes('not found') ? 404 : 400;
    return NextResponse.json({ error: safeMessage(error) }, { status });
  }

  return NextResponse.json({ matchId, lockedAt });
}
