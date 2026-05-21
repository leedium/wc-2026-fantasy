import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { safeMessage } from '@/lib/api/errors';

/**
 * Authenticated read of the caller's own referral state. Returns the
 * shareable code + aggregate counts. The referee list is deliberately
 * not exposed (use the admin moderation RPC for that).
 */
export async function GET() {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase.rpc('get_referral_status');
  if (error) {
    return NextResponse.json({ error: safeMessage(error) }, { status: 400 });
  }

  // The RPC returns a single-row TABLE; supabase-js gives us an array.
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    return NextResponse.json({
      code: null,
      availableCredits: 0,
      qualifiedTotal: 0,
      redeemedTotal: 0,
    });
  }

  return NextResponse.json({
    code: row.referral_code ?? null,
    availableCredits: row.available_credits ?? 0,
    qualifiedTotal: row.qualified_total ?? 0,
    redeemedTotal: row.redeemed_total ?? 0,
  });
}
