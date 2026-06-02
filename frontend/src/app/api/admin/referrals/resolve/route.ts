import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin, isAdminGateError } from '@/lib/auth/requireAdmin';
import { safeMessage } from '@/lib/api/errors';

/**
 * Live email resolution for the "Apply a referral" dialog. Returns the
 * matching account (if any), whether it has a non-free payment (so the UI can
 * say "qualifies immediately"), and who — if anyone — already referred it.
 */
export async function GET(request: NextRequest) {
  const ctx = await requireAdmin();
  if (isAdminGateError(ctx)) return ctx.response;

  const email = request.nextUrl.searchParams.get('email')?.trim();
  if (!email) {
    return NextResponse.json({ found: false });
  }

  const { data, error } = await ctx.supabase.rpc('admin_resolve_referee', {
    p_email: email,
  });

  if (error) {
    return NextResponse.json({ error: safeMessage(error) }, { status: 400 });
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    return NextResponse.json({ found: false });
  }

  return NextResponse.json({
    found: true,
    refereeId: row.referee_id,
    username: row.username,
    hasPaid: row.has_paid,
    currentReferrerId: row.current_referrer_id ?? null,
    currentReferrerUsername: row.current_referrer_username ?? null,
  });
}
