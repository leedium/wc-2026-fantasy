import { NextResponse, type NextRequest } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { safeMessage } from '@/lib/api/errors';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Atomically claim one of the caller's available referral credits and
 * apply it to the given (owned, unpaid, pre-lock) prediction. The RPC
 * itself does the auth + ownership + lock + double-spend checks; we
 * only translate its raises into HTTP status codes.
 */
export async function POST(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase.rpc('redeem_referral_credit', {
    p_prediction_id: id,
  });

  if (error) {
    const msg = error.message ?? '';
    let status = 400;
    if (msg.includes('not authenticated')) status = 401;
    else if (msg.includes('not your prediction')) status = 403;
    else if (msg.includes('predictions are locked')) status = 403;
    else if (msg.includes('prediction not found')) status = 404;
    else if (msg.includes('no referral credits available')) status = 409;
    else if (msg.includes('prediction already paid')) status = 409;
    return NextResponse.json({ error: safeMessage(error) }, { status });
  }

  return NextResponse.json({ paymentId: data });
}
