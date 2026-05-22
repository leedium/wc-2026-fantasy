import { NextResponse, type NextRequest } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { safeMessage } from '@/lib/api/errors';

/**
 * Atomically claim one of the caller's available free-pick credits and
 * apply it to the given (owned, unpaid, pre-lock) prediction. Prefers
 * referral credits first, then loyalty — see redeem_free_pick in
 * supabase/migrations/0038_loyalty_credits.sql for the wiring.
 * Returns the new payment id and which source (referral | loyalty) was
 * consumed so the client can show source-attributed feedback.
 */
export async function POST(request: NextRequest) {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { predictionId?: unknown } = {};
  try {
    body = (await request.json()) as { predictionId?: unknown };
  } catch {
    return NextResponse.json({ error: 'invalid json body' }, { status: 400 });
  }
  const predictionId = typeof body.predictionId === 'string' ? body.predictionId : '';
  if (!predictionId) {
    return NextResponse.json({ error: 'predictionId is required' }, { status: 400 });
  }

  const { data, error } = await supabase.rpc('redeem_free_pick', {
    p_prediction_id: predictionId,
  });

  if (error) {
    const msg = error.message ?? '';
    let status = 400;
    if (msg.includes('not authenticated')) status = 401;
    else if (msg.includes('not your prediction')) status = 403;
    else if (msg.includes('predictions are locked')) status = 403;
    else if (msg.includes('prediction not found')) status = 404;
    else if (msg.includes('no free picks available')) status = 409;
    else if (msg.includes('no referral credits available')) status = 409;
    else if (msg.includes('no loyalty credits available')) status = 409;
    else if (msg.includes('prediction already paid')) status = 409;
    return NextResponse.json({ error: safeMessage(error) }, { status });
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    return NextResponse.json({ error: 'request failed' }, { status: 500 });
  }

  return NextResponse.json({
    paymentId: row.payment_id,
    source: row.source,
  });
}
