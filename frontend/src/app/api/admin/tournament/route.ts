import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin, isAdminGateError } from '@/lib/auth/requireAdmin';
import { safeMessage } from '@/lib/api/errors';

interface Body {
  id?: string;
  status?: 'upcoming' | 'group_stage' | 'knockout' | 'completed';
  lockTime?: string;
  isActive?: boolean;
  championTotalGoals?: number | null;
  /** Phase 2 toggle. When set, routes through admin_set_phase_two RPC which
   *  validates that all 8 advancers are populated before opening. */
  knockoutUnlocked?: boolean;
  knockoutLockTime?: string | null;
}

const VALID_STATUSES = ['upcoming', 'group_stage', 'knockout', 'completed'] as const;

export async function PATCH(request: NextRequest) {
  const ctx = await requireAdmin();
  if (isAdminGateError(ctx)) return ctx.response;

  const body = (await request.json()) as Body;
  if (!body.id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }
  if (body.status && !VALID_STATUSES.includes(body.status)) {
    return NextResponse.json({ error: 'invalid status' }, { status: 400 });
  }
  if (
    body.championTotalGoals !== undefined &&
    body.championTotalGoals !== null &&
    (!Number.isInteger(body.championTotalGoals) ||
      body.championTotalGoals < 0 ||
      body.championTotalGoals > 200)
  ) {
    return NextResponse.json(
      { error: 'championTotalGoals must be an integer 0-200' },
      { status: 400 }
    );
  }

  // Phase 2 toggle has its own RPC (validates advancer count). Run it first
  // so a failed check leaves the rest of the patch intact.
  if (body.knockoutUnlocked !== undefined) {
    const { error: phaseError } = await ctx.supabase.rpc('admin_set_phase_two', {
      p_tournament_id: body.id,
      p_unlocked: body.knockoutUnlocked,
      p_lock_time: body.knockoutLockTime ?? null,
    });
    if (phaseError) {
      const msg = phaseError.message ?? '';
      const status = msg.includes('all 8 advancers') ? 409 : 400;
      return NextResponse.json({ error: safeMessage(phaseError) }, { status });
    }
  }

  const update: Record<string, unknown> = {};
  if (body.status !== undefined) update.status = body.status;
  if (body.lockTime !== undefined) update.lock_time = body.lockTime;
  if (body.isActive !== undefined) update.is_active = body.isActive;
  if (body.championTotalGoals !== undefined) update.champion_total_goals = body.championTotalGoals;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ ok: true });
  }

  const { error } = await ctx.supabase.from('tournaments').update(update).eq('id', body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
