import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { getServerSupabase } from '@/lib/supabase/server';
import {
  PredictionsPageContent,
  type InitialPrediction,
} from '@/app/predictions/PredictionsPageContent';

export const metadata: Metadata = {
  title: 'Edit Prediction | Admin',
};

export default async function AdminEditPredictionPage({
  params,
}: {
  params: Promise<{ id: string; predictionId: string }>;
}) {
  const { id, predictionId } = await params;
  const supabase = await getServerSupabase();

  const { data: prediction } = await supabase
    .from('predictions')
    .select(
      'id, prediction_name, total_goals, submitted_at, tournament_payments(paid_at)'
    )
    .eq('id', predictionId)
    .eq('user_id', id)
    .maybeSingle();

  if (!prediction) notFound();

  const [groupsRes, knockoutRes] = await Promise.all([
    supabase
      .from('group_predictions')
      .select('group_id, first_team_id, second_team_id, third_team_id, fourth_team_id')
      .eq('prediction_id', predictionId),
    supabase
      .from('knockout_predictions')
      .select('match_id, winner_team_id')
      .eq('prediction_id', predictionId),
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
  };

  return (
    <PredictionsPageContent
      mode="edit"
      predictionId={predictionId}
      initial={initial}
      apiBasePath={`/api/admin/users/${id}/predictions`}
    />
  );
}
