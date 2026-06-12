import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin, isAdminGateError } from '@/lib/auth/requireAdmin';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { safeMessage } from '@/lib/api/errors';
import { PREDICTION_NAME_MAX, PREDICTION_NAME_REGEX } from '@/lib/constants';

interface SubmitPayload {
  tournamentId?: string;
  predictionName?: string;
  totalGoals?: number | null;
  championTeamId?: string | null;
  submit?: boolean;
  groups?: Array<{
    groupId: string;
    first: string | null;
    second: string | null;
    third: string | null;
    fourth: string | null;
  }>;
  knockout?: Array<{ matchId: string; winner: string | null }>;
  advancers?: Array<{ rank: number; teamId: string }>;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireAdmin();
  if (isAdminGateError(ctx)) return ctx.response;

  const { id: userId } = await params;
  const { supabase } = ctx;

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('id, lock_time')
    .eq('is_active', true)
    .maybeSingle();

  if (!tournament) {
    return NextResponse.json({ error: 'No active tournament' }, { status: 404 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('username, display_name')
    .eq('id', userId)
    .maybeSingle();

  let email: string | null = null;
  try {
    const admin = createAdminSupabaseClient();
    const { data: authUser } = await admin.auth.admin.getUserById(userId);
    email = authUser.user?.email ?? null;
  } catch {
    // Service role unavailable (e.g. in tests); email simply omitted.
  }

  const { data: predictions } = await supabase
    .from('predictions')
    .select(
      'id, prediction_name, total_goals, champion_team_id, submitted_at, tournament_payments!prediction_id(paid_at, marked_by, is_free)'
    )
    .eq('user_id', userId)
    .eq('tournament_id', tournament.id)
    .order('submitted_at', { ascending: true });

  type Payment = { paid_at: string | null; marked_by: string | null; is_free: boolean | null };
  type Pred = {
    id: string;
    prediction_name: string;
    total_goals: number | null;
    champion_team_id: string | null;
    submitted_at: string | null;
    // PostgREST returns an object (not array) when the embed resolves through
    // a unique FK — `tournament_payments.prediction_id` is unique, so it's 1:1.
    tournament_payments: Payment | Payment[] | null;
  };

  const unwrapPayment = (v: Pred['tournament_payments']): Payment | null => {
    if (!v) return null;
    return Array.isArray(v) ? (v[0] ?? null) : v;
  };

  return NextResponse.json({
    tournament: { id: tournament.id, lockTime: tournament.lock_time },
    user: {
      id: userId,
      username: (profile?.username as string | undefined) ?? null,
      displayName: (profile?.display_name as string | null | undefined) ?? null,
      email,
    },
    predictions: ((predictions ?? []) as Pred[]).map((p) => {
      const payment = unwrapPayment(p.tournament_payments);
      return {
        id: p.id,
        name: p.prediction_name,
        totalGoals: p.total_goals,
        championTeamId: p.champion_team_id,
        submittedAt: p.submitted_at,
        isPaid: payment != null,
        paidAt: payment?.paid_at ?? null,
        markedBy: payment?.marked_by ?? null,
        isFreePaid: payment?.is_free === true,
      };
    }),
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireAdmin();
  if (isAdminGateError(ctx)) return ctx.response;

  const { id: userId } = await params;
  const body = (await request.json()) as SubmitPayload;

  if (!body.tournamentId) {
    return NextResponse.json({ error: 'tournamentId is required' }, { status: 400 });
  }
  const name = body.predictionName?.trim();
  if (!name) {
    return NextResponse.json({ error: 'predictionName is required' }, { status: 400 });
  }
  if (name.length > PREDICTION_NAME_MAX || !PREDICTION_NAME_REGEX.test(name)) {
    return NextResponse.json({ error: 'predictionName format invalid' }, { status: 400 });
  }
  if (body.totalGoals != null && (body.totalGoals < 0 || body.totalGoals > 200)) {
    return NextResponse.json({ error: 'totalGoals must be 0-200' }, { status: 400 });
  }
  if (!Array.isArray(body.groups) || !Array.isArray(body.knockout)) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }
  const championTeamId = body.championTeamId?.trim() || null;
  if (!championTeamId) {
    return NextResponse.json({ error: 'championTeamId is required' }, { status: 400 });
  }

  const payload = {
    tournament_id: body.tournamentId,
    prediction_name: name,
    total_goals: body.totalGoals,
    champion_team_id: championTeamId,
    submit: body.submit !== false,
    groups: body.groups.map((g) => ({
      group_id: g.groupId,
      first: g.first,
      second: g.second,
      third: g.third,
      fourth: g.fourth,
    })),
    knockout: body.knockout.map((k) => ({
      match_id: k.matchId,
      winner: k.winner,
    })),
    advancers: (body.advancers ?? []).map((a) => ({
      rank: a.rank,
      team_id: a.teamId,
    })),
  };

  const { data, error } = await ctx.supabase.rpc('admin_submit_predictions', {
    p_user_id: userId,
    payload,
  });
  if (error) {
    const msg = error.message ?? '';
    let status = 400;
    if (msg.includes('name taken')) status = 409;
    else if (msg.includes('duplicate advancer')) status = 409;
    else if (msg.includes('advancer')) status = 400;
    else if (msg.includes('champion pick')) status = 400;
    return NextResponse.json({ error: safeMessage(error) }, { status });
  }
  return NextResponse.json({ predictionId: data });
}
