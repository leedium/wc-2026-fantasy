import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import { getServerSupabase } from '@/lib/supabase/server';
import { ROUTES } from '@/lib/constants';
import { PredictionsPageContent, type InitialPrediction } from '../PredictionsPageContent';

export const metadata: Metadata = {
  title: 'Edit Prediction | World Cup 2026',
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditPredictionPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`${ROUTES.login}?next=${encodeURIComponent(ROUTES.predictions)}`);

  const { data: prediction } = await supabase
    .from('predictions')
    .select(
      'id, prediction_name, total_goals, submitted_at, tournament_payments(paid_at)'
    )
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!prediction) notFound();

  const [groupsRes, knockoutRes, advancersRes] = await Promise.all([
    supabase
      .from('group_predictions')
      .select('group_id, first_team_id, second_team_id, third_team_id, fourth_team_id')
      .eq('prediction_id', id),
    supabase
      .from('knockout_predictions')
      .select('match_id, winner_team_id')
      .eq('prediction_id', id),
    supabase
      .from('advancer_predictions')
      .select('rank, team_id')
      .eq('prediction_id', id),
  ]);

  type Pred = typeof prediction & {
    tournament_payments: Array<{ paid_at: string | null }> | null;
  };
  const p = prediction as Pred;
  const payment = p.tournament_payments?.[0] ?? null;

  const initial: InitialPrediction = {
    id: p.id,
    name: p.prediction_name,
    totalGoals: p.total_goals,
    submittedAt: p.submitted_at,
    isPaid: payment != null,
    paidAt: payment?.paid_at ?? null,
    groups: (groupsRes.data ?? []).map((g) => ({
      groupId: g.group_id,
      first: g.first_team_id,
      second: g.second_team_id,
      third: g.third_team_id,
      fourth: g.fourth_team_id,
    })),
    knockout: (knockoutRes.data ?? []).map((k) => ({
      matchId: k.match_id,
      winner: k.winner_team_id,
    })),
    advancers: (advancersRes.data ?? []).map((a) => ({
      rank: a.rank as number,
      teamId: a.team_id as string,
    })),
  };

  return <PredictionsPageContent mode="edit" predictionId={id} initial={initial} />;
}
