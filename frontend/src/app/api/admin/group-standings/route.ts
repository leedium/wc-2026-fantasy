import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin, isAdminGateError } from '@/lib/auth/requireAdmin';

interface Body {
  tournamentId?: string;
  groupId?: string;
  first?: string;
  second?: string;
  third?: string;
  fourth?: string;
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
    .from('group_standings')
    .select('group_id, first_team_id, second_team_id, third_team_id, fourth_team_id, submitted_at')
    .eq('tournament_id', tournamentId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(request: NextRequest) {
  const ctx = await requireAdmin();
  if (isAdminGateError(ctx)) return ctx.response;

  const body = (await request.json()) as Body;
  if (!body.tournamentId || !body.groupId) {
    return NextResponse.json(
      { error: 'tournamentId and groupId are required' },
      { status: 400 }
    );
  }
  if (!body.first || !body.second || !body.third || !body.fourth) {
    return NextResponse.json({ error: 'all four positions are required' }, { status: 400 });
  }

  const { error } = await ctx.supabase.rpc('admin_set_group_standing', {
    p_tournament_id: body.tournamentId,
    p_group_id: body.groupId,
    p_first: body.first,
    p_second: body.second,
    p_third: body.third,
    p_fourth: body.fourth,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
