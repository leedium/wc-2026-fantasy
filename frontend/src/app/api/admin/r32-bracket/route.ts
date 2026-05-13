import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin, isAdminGateError } from '@/lib/auth/requireAdmin';
import { safeMessage } from '@/lib/api/errors';

interface PatchBody {
  tournamentId?: string;
  matchId?: string;
  slot?: 1 | 2;
  teamId?: string;
}

interface DeleteBody {
  tournamentId?: string;
  matchId?: string;
  slot?: 1 | 2;
}

export async function GET() {
  const ctx = await requireAdmin();
  if (isAdminGateError(ctx)) return ctx.response;

  const { data: tournament } = await ctx.supabase
    .from('tournaments')
    .select('id')
    .eq('is_active', true)
    .maybeSingle();
  if (!tournament) return NextResponse.json({ error: 'No active tournament' }, { status: 404 });

  const { data, error } = await ctx.supabase
    .from('r32_bracket_assignments')
    .select('match_id, slot, team_id')
    .eq('tournament_id', tournament.id)
    .order('match_id', { ascending: true });

  if (error) return NextResponse.json({ error: safeMessage(error) }, { status: 400 });

  return NextResponse.json({
    tournamentId: tournament.id,
    assignments: (data ?? []).map((r) => ({
      matchId: r.match_id as string,
      slot: r.slot as 1 | 2,
      teamId: r.team_id as string,
    })),
  });
}

export async function PATCH(request: NextRequest) {
  const ctx = await requireAdmin();
  if (isAdminGateError(ctx)) return ctx.response;

  const body = (await request.json()) as PatchBody;
  if (!body.tournamentId) {
    return NextResponse.json({ error: 'tournamentId is required' }, { status: 400 });
  }
  if (!body.matchId) {
    return NextResponse.json({ error: 'matchId is required' }, { status: 400 });
  }
  if (body.slot !== 1 && body.slot !== 2) {
    return NextResponse.json({ error: 'slot must be 1 or 2' }, { status: 400 });
  }
  if (!body.teamId) {
    return NextResponse.json({ error: 'teamId is required' }, { status: 400 });
  }

  const { error } = await ctx.supabase.rpc('admin_set_r32_bracket', {
    p_tournament_id: body.tournamentId,
    p_match_id: body.matchId,
    p_slot: body.slot,
    p_team_id: body.teamId,
  });
  if (error) {
    const msg = error.message ?? '';
    let status = 400;
    if (msg.includes('not a 3rd-place slot')) status = 400;
    else if (msg.includes('not in the top-8 advancers')) status = 400;
    else if (msg.includes('unknown R32 match')) status = 404;
    return NextResponse.json({ error: safeMessage(error) }, { status });
  }
  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const ctx = await requireAdmin();
  if (isAdminGateError(ctx)) return ctx.response;

  const body = (await request.json().catch(() => ({}))) as DeleteBody;
  if (!body.tournamentId || !body.matchId) {
    return NextResponse.json({ error: 'tournamentId and matchId are required' }, { status: 400 });
  }
  if (body.slot !== 1 && body.slot !== 2) {
    return NextResponse.json({ error: 'slot must be 1 or 2' }, { status: 400 });
  }

  const { error } = await ctx.supabase.rpc('admin_clear_r32_bracket', {
    p_tournament_id: body.tournamentId,
    p_match_id: body.matchId,
    p_slot: body.slot,
  });
  if (error) {
    return NextResponse.json({ error: safeMessage(error) }, { status: 400 });
  }
  return NextResponse.json({ success: true });
}
