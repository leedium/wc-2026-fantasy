import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin, isAdminGateError } from '@/lib/auth/requireAdmin';
import { safeMessage } from '@/lib/api/errors';

interface Body {
  tournamentId?: string;
  matchId?: string;
  winnerTeamId?: string;
  loserTeamId?: string;
  totalGoals?: number | null;
}

export async function GET(request: NextRequest) {
  const ctx = await requireAdmin();
  if (isAdminGateError(ctx)) return ctx.response;

  const { searchParams } = new URL(request.url);
  const tournamentId = searchParams.get('tournamentId');
  if (!tournamentId) {
    return NextResponse.json({ error: 'tournamentId is required' }, { status: 400 });
  }

  const { data, error } = await ctx.supabase
    .from('knockout_results')
    .select('match_id, winner_team_id, loser_team_id, total_goals, submitted_at')
    .eq('tournament_id', tournamentId);

  if (error) return NextResponse.json({ error: safeMessage(error) }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(request: NextRequest) {
  const ctx = await requireAdmin();
  if (isAdminGateError(ctx)) return ctx.response;

  const body = (await request.json()) as Body;
  if (!body.tournamentId || !body.matchId || !body.winnerTeamId || !body.loserTeamId) {
    return NextResponse.json(
      { error: 'tournamentId, matchId, winnerTeamId, loserTeamId are required' },
      { status: 400 }
    );
  }

  const { error } = await ctx.supabase.rpc('admin_set_knockout_result', {
    p_tournament_id: body.tournamentId,
    p_match_id: body.matchId,
    p_winner_team_id: body.winnerTeamId,
    p_loser_team_id: body.loserTeamId,
    p_total_goals: body.totalGoals ?? null,
  });

  if (error) return NextResponse.json({ error: safeMessage(error) }, { status: 400 });
  return NextResponse.json({ ok: true });
}
