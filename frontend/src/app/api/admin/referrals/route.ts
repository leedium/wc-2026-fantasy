import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin, isAdminGateError } from '@/lib/auth/requireAdmin';
import { safeMessage } from '@/lib/api/errors';

/** Map an RPC error message to an HTTP status. */
function statusFor(message: string): number {
  const m = message.toLowerCase();
  if (m.includes('not authenticated')) return 401;
  if (m.includes('forbidden')) return 403;
  if (m.includes('referee account not found')) return 404;
  if (m.includes('referrer not found')) return 404;
  if (m.includes('referral not found')) return 404;
  if (m.includes('referee already referred')) return 409;
  if (m.includes('cannot refer self')) return 409;
  return 400;
}

type ReferralRow = {
  direction: 'inbound' | 'outbound';
  referee_id: string;
  referee_username: string;
  referee_email: string | null;
  referrer_id: string;
  referrer_username: string;
  referrer_email: string | null;
  referrer_code_used: string;
  source: 'admin' | 'organic';
  has_paid: boolean;
  created_at: string;
  qualified_at: string | null;
};

/**
 * Full referral state for one member: derived credit summary, the referees
 * they brought in (outbound), who referred them (inbound), and the admin
 * audit trail. Powers the /admin/referrals tool.
 */
export async function GET(request: NextRequest) {
  const ctx = await requireAdmin();
  if (isAdminGateError(ctx)) return ctx.response;

  const userId = request.nextUrl.searchParams.get('userId')?.trim();
  if (!userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 });
  }

  const [overviewRes, listRes, auditRes] = await Promise.all([
    ctx.supabase.rpc('admin_referral_overview', { p_user_id: userId }),
    ctx.supabase.rpc('admin_list_user_referrals', { p_user_id: userId }),
    ctx.supabase.rpc('admin_list_referral_audit', { p_user_id: userId }),
  ]);

  const firstError = overviewRes.error ?? listRes.error ?? auditRes.error;
  if (firstError) {
    return NextResponse.json(
      { error: safeMessage(firstError) },
      { status: statusFor(firstError.message ?? '') }
    );
  }

  const o = (Array.isArray(overviewRes.data) ? overviewRes.data[0] : overviewRes.data) ?? null;
  const rows = (listRes.data ?? []) as ReferralRow[];

  const referees = rows
    .filter((r) => r.direction === 'outbound')
    .map((r) => ({
      refereeId: r.referee_id,
      refereeUsername: r.referee_username,
      refereeEmail: r.referee_email,
      source: r.source,
      hasPaid: r.has_paid,
      createdAt: r.created_at,
      qualifiedAt: r.qualified_at,
    }));

  const inboundRow = rows.find((r) => r.direction === 'inbound');
  const inbound = inboundRow
    ? {
        referrerId: inboundRow.referrer_id,
        referrerUsername: inboundRow.referrer_username,
        referrerCodeUsed: inboundRow.referrer_code_used,
        source: inboundRow.source,
        createdAt: inboundRow.created_at,
        qualifiedAt: inboundRow.qualified_at,
      }
    : null;

  const audit = (
    auditRes.data as Array<{
      id: string;
      actor_username: string | null;
      action: 'add' | 'remove';
      referrer_username: string | null;
      referee_username: string | null;
      referee_email: string | null;
      note: string;
      created_at: string;
    }> | null
  )?.map((a) => ({
    id: a.id,
    actorUsername: a.actor_username,
    action: a.action,
    referrerUsername: a.referrer_username,
    refereeUsername: a.referee_username,
    refereeEmail: a.referee_email,
    note: a.note,
    createdAt: a.created_at,
  })) ?? [];

  return NextResponse.json({
    overview: {
      referralCode: o?.referral_code ?? null,
      qualifiedTotal: o?.qualified_total ?? 0,
      earnedCredits: o?.earned_credits ?? 0,
      redeemedTotal: o?.redeemed_total ?? 0,
      availableCredits: o?.available_credits ?? 0,
      refereeCount: o?.referee_count ?? 0,
    },
    referees,
    inbound,
    audit,
  });
}

/** Link a referee account (by email) to a referrer. */
export async function POST(request: NextRequest) {
  const ctx = await requireAdmin();
  if (isAdminGateError(ctx)) return ctx.response;

  let body: { referrerId?: unknown; refereeEmail?: unknown; note?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid json body' }, { status: 400 });
  }

  const referrerId = typeof body.referrerId === 'string' ? body.referrerId.trim() : '';
  const refereeEmail = typeof body.refereeEmail === 'string' ? body.refereeEmail.trim() : '';
  const note = typeof body.note === 'string' ? body.note.trim() : '';
  if (!referrerId) {
    return NextResponse.json({ error: 'referrerId is required' }, { status: 400 });
  }
  if (!refereeEmail) {
    return NextResponse.json({ error: 'refereeEmail is required' }, { status: 400 });
  }
  if (!note) {
    return NextResponse.json({ error: 'note is required' }, { status: 400 });
  }

  const { data, error } = await ctx.supabase.rpc('admin_add_referral', {
    p_referrer_id: referrerId,
    p_referee_email: refereeEmail,
    p_note: note,
  });

  if (error) {
    return NextResponse.json(
      { error: safeMessage(error) },
      { status: statusFor(error.message ?? '') }
    );
  }

  const row = Array.isArray(data) ? data[0] : data;
  return NextResponse.json(
    { refereeId: row?.referee_id ?? null, qualified: row?.qualified ?? false },
    { status: 201 }
  );
}

/** Unlink a referee. */
export async function DELETE(request: NextRequest) {
  const ctx = await requireAdmin();
  if (isAdminGateError(ctx)) return ctx.response;

  let body: { refereeId?: unknown; note?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid json body' }, { status: 400 });
  }

  const refereeId = typeof body.refereeId === 'string' ? body.refereeId.trim() : '';
  const note = typeof body.note === 'string' ? body.note.trim() : '';
  if (!refereeId) {
    return NextResponse.json({ error: 'refereeId is required' }, { status: 400 });
  }
  if (!note) {
    return NextResponse.json({ error: 'note is required' }, { status: 400 });
  }

  const { error } = await ctx.supabase.rpc('admin_remove_referral', {
    p_referee_id: refereeId,
    p_note: note,
  });

  if (error) {
    return NextResponse.json(
      { error: safeMessage(error) },
      { status: statusFor(error.message ?? '') }
    );
  }

  return NextResponse.json({ ok: true });
}
