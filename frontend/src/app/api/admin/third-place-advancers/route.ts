import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin, isAdminGateError } from '@/lib/auth/requireAdmin';
import { safeMessage } from '@/lib/api/errors';

interface PatchBody {
  tournamentId?: string;
  slotIndex?: number;
  groupLetter?: string;
}

interface DeleteBody {
  tournamentId?: string;
  slotIndex?: number;
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
    .from('tournament_third_place_advancers')
    .select('slot_index, group_letter')
    .eq('tournament_id', tournament.id)
    .order('slot_index', { ascending: true });

  if (error) return NextResponse.json({ error: safeMessage(error) }, { status: 400 });

  return NextResponse.json({
    tournamentId: tournament.id,
    advancers: (data ?? []).map((r) => ({
      slotIndex: r.slot_index as number,
      groupLetter: r.group_letter as string,
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
  if (typeof body.slotIndex !== 'number' || body.slotIndex < 0 || body.slotIndex > 7) {
    return NextResponse.json({ error: 'slotIndex must be 0-7' }, { status: 400 });
  }
  if (typeof body.groupLetter !== 'string' || !body.groupLetter) {
    return NextResponse.json({ error: 'groupLetter is required' }, { status: 400 });
  }

  const { error } = await ctx.supabase.rpc('admin_set_third_place_advancer', {
    p_tournament_id: body.tournamentId,
    p_slot_index: body.slotIndex,
    p_group_letter: body.groupLetter,
  });
  if (error) {
    const msg = error.message ?? '';
    const status = msg.includes('unknown bundle slot') ? 404 : 400;
    return NextResponse.json({ error: safeMessage(error) }, { status });
  }
  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const ctx = await requireAdmin();
  if (isAdminGateError(ctx)) return ctx.response;

  const body = (await request.json().catch(() => ({}))) as DeleteBody;
  if (!body.tournamentId) {
    return NextResponse.json({ error: 'tournamentId is required' }, { status: 400 });
  }
  if (typeof body.slotIndex !== 'number' || body.slotIndex < 0 || body.slotIndex > 7) {
    return NextResponse.json({ error: 'slotIndex must be 0-7' }, { status: 400 });
  }

  const { error } = await ctx.supabase.rpc('admin_clear_third_place_advancer', {
    p_tournament_id: body.tournamentId,
    p_slot_index: body.slotIndex,
  });
  if (error) {
    return NextResponse.json({ error: safeMessage(error) }, { status: 400 });
  }
  return NextResponse.json({ success: true });
}
