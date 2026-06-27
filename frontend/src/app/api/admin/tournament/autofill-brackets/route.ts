import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin, isAdminGateError } from '@/lib/auth/requireAdmin';
import { safeMessage } from '@/lib/api/errors';

interface Body {
  id?: string;
}

/**
 * Auto-fill missing Phase 2 (knockout) brackets for the given tournament after
 * the knockout deadline. Super-admin-gated; calls admin_autofill_phase2_brackets
 * (migration 0071), which fills only blank matches for paid, Phase-1-complete
 * entries and never overwrites a user's picks. Returns a fill summary.
 */
export async function POST(request: NextRequest) {
  const ctx = await requireAdmin();
  if (isAdminGateError(ctx)) return ctx.response;

  const body = (await request.json()) as Body;
  if (!body.id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  const { data, error } = await ctx.supabase.rpc('admin_autofill_phase2_brackets', {
    p_tournament_id: body.id,
  });

  if (error) {
    const msg = (error.message ?? '').toLowerCase();
    let status = 400;
    if (msg.includes('forbidden')) status = 403;
    else if (msg.includes('not found')) status = 404;
    else if (msg.includes('not phase2_locked')) status = 409;
    return NextResponse.json({ error: safeMessage(error) }, { status });
  }

  return NextResponse.json({ ok: true, summary: data });
}
