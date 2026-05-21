import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin, isAdminGateError } from '@/lib/auth/requireAdmin';
import { safeMessage } from '@/lib/api/errors';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Admin moderation: list all referral rows where this user is either the
 * referee (one row, "inbound") or the referrer ("outbound", any number).
 * Useful for spotting self-referral patterns or farming attempts.
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  const ctx = await requireAdmin();
  if (isAdminGateError(ctx)) return ctx.response;
  const { id } = await context.params;

  const { data, error } = await ctx.supabase.rpc('admin_list_user_referrals', {
    p_user_id: id,
  });

  if (error) {
    return NextResponse.json({ error: safeMessage(error) }, { status: 400 });
  }

  return NextResponse.json({
    referrals: (data ?? []).map(
      (r: {
        direction: 'inbound' | 'outbound';
        referee_id: string;
        referee_username: string;
        referrer_id: string;
        referrer_username: string;
        referrer_code_used: string;
        created_at: string;
        qualified_at: string | null;
        reward_redeemed_at: string | null;
        reward_prediction_id: string | null;
      }) => ({
        direction: r.direction,
        refereeId: r.referee_id,
        refereeUsername: r.referee_username,
        referrerId: r.referrer_id,
        referrerUsername: r.referrer_username,
        referrerCodeUsed: r.referrer_code_used,
        createdAt: r.created_at,
        qualifiedAt: r.qualified_at,
        rewardRedeemedAt: r.reward_redeemed_at,
        rewardPredictionId: r.reward_prediction_id,
      })
    ),
  });
}
