import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin, isAdminGateError } from '@/lib/auth/requireAdmin';
import { safeMessage } from '@/lib/api/errors';

interface Body {
  id?: string;
}

/**
 * Reset Phase 2: revert a tournament to its locked Phase 1 state. Super-admin-gated;
 * calls admin_reset_phase_two (migration 0076), which clears knockout_unlocked +
 * knockout_lock_time and deletes the tournament's per-fixture locks, while preserving
 * all knockout predictions (re-opening Phase 2 restores them).
 */
export async function POST(request: NextRequest) {
  const ctx = await requireAdmin();
  if (isAdminGateError(ctx)) return ctx.response;

  const body = (await request.json()) as Body;
  if (!body.id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  const { error } = await ctx.supabase.rpc('admin_reset_phase_two', {
    p_tournament_id: body.id,
  });

  if (error) {
    const msg = (error.message ?? '').toLowerCase();
    const status = msg.includes('forbidden') ? 403 : msg.includes('not found') ? 404 : 400;
    return NextResponse.json({ error: safeMessage(error) }, { status });
  }

  return NextResponse.json({ ok: true });
}
