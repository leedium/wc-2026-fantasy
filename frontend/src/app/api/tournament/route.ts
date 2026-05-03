import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await getServerSupabase();
  const { data, error } = await supabase
    .from('tournaments')
    .select('id, slug, name, status, lock_time, total_entries, champion_total_goals')
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: 'No active tournament' }, { status: 404 });
  }

  return NextResponse.json({
    id: data.id,
    slug: data.slug,
    name: data.name,
    status: data.status,
    lockTime: data.lock_time,
    totalEntries: data.total_entries,
    championTotalGoals: data.champion_total_goals,
  });
}
