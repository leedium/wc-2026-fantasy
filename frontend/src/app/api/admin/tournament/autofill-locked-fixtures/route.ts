import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin, isAdminGateError } from '@/lib/auth/requireAdmin';
import { safeMessage } from '@/lib/api/errors';

interface Body {
  id?: string;
}

/**
 * Fill blanks for knockout fixtures that have already individually locked
 * (kicked off), while Phase 2 is still open. Super-admin-gated; calls
 * admin_autofill_locked_fixtures (migration 0072), which reuses the same
 * outcome-blind winner rule as the whole-bracket autofill but touches only
 * locked fixtures and never overwrites a user's pick. Returns a fill summary.
 */
export async function POST(request: NextRequest) {
  const ctx = await requireAdmin();
  if (isAdminGateError(ctx)) return ctx.response;

  const body = (await request.json()) as Body;
  if (!body.id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  const { data, error } = await ctx.supabase.rpc('admin_autofill_locked_fixtures', {
    p_tournament_id: body.id,
  });

  if (error) {
    const msg = (error.message ?? '').toLowerCase();
    let status = 400;
    if (msg.includes('forbidden')) status = 403;
    else if (msg.includes('not found')) status = 404;
    else if (msg.includes('not open') || msg.includes('incomplete')) status = 409;
    return NextResponse.json({ error: safeMessage(error) }, { status });
  }

  return NextResponse.json({ ok: true, summary: data });
}
