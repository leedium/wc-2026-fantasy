import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import type { Phase1Winner } from '@/types/tournament';

/**
 * Public read of the frozen Phase 1 (group + advancer) top 3 for the active
 * tournament. Populated by an admin snapshot (admin_snapshot_phase1_winners,
 * migration 0070). Returns an empty array until a snapshot has been taken, so
 * the consuming card stays hidden pre-snapshot. The data is non-sensitive
 * (usernames + points), readable by anon via the phase1_winners RLS policy.
 */
export async function GET() {
  const supabase = await getServerSupabase();

  const { data: tournament, error: tournamentError } = await supabase
    .from('tournaments')
    .select('id')
    .eq('is_active', true)
    .maybeSingle();
  if (tournamentError) {
    return NextResponse.json({ error: 'request failed' }, { status: 500 });
  }
  if (!tournament) {
    return NextResponse.json({ winners: [] });
  }

  const { data, error } = await supabase
    .from('phase1_winners')
    .select(
      'rank, prediction_id, prediction_name, username, group_points, advancer_points, phase1_points',
    )
    .eq('tournament_id', tournament.id)
    .order('rank');
  if (error) {
    return NextResponse.json({ error: 'request failed' }, { status: 500 });
  }

  const winners: Phase1Winner[] = (data ?? []).map((row) => ({
    rank: row.rank,
    predictionId: row.prediction_id,
    predictionName: row.prediction_name,
    username: row.username,
    groupPoints: row.group_points,
    advancerPoints: Number(row.advancer_points),
    phase1Points: Number(row.phase1_points),
  }));

  return NextResponse.json({ winners });
}
