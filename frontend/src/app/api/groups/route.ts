import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await getServerSupabase();
  const [groupsRes, teamsRes] = await Promise.all([
    supabase.from('groups').select('id, name').order('id'),
    supabase.from('teams').select('id, name, code, group_id').order('name'),
  ]);

  if (groupsRes.error) {
    return NextResponse.json({ error: groupsRes.error.message }, { status: 500 });
  }
  if (teamsRes.error) {
    return NextResponse.json({ error: teamsRes.error.message }, { status: 500 });
  }

  const groups = groupsRes.data.map((g) => ({
    id: g.id,
    name: g.name,
    teams: teamsRes.data
      .filter((t) => t.group_id === g.id)
      .map((t) => ({ id: t.id, name: t.name, code: t.code, group: t.group_id })),
  }));

  return NextResponse.json(groups, {
    headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' },
  });
}
