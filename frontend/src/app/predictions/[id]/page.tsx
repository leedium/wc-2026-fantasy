import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import { getServerSupabase } from '@/lib/supabase/server';
import { ROUTES } from '@/lib/constants';
import { AdminBreadcrumb } from '@/components/admin/AdminBreadcrumb';
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
      'id, prediction_name, total_goals, champion_team_id, submitted_at, tournament_payments!prediction_id(paid_at)'
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

  // PostgREST returns a single object (not an array) when the embedded
  // relation has a unique FK target — `tournament_payments.prediction_id`
  // is UNIQUE, so it's 1:1. Handle both shapes to be safe.
  type Payment = { paid_at: string | null };
  type Pred = typeof prediction & {
    tournament_payments: Payment | Payment[] | null;
  };
  const p = prediction as Pred;
  const rawPayment = p.tournament_payments;
  const payment: Payment | null = !rawPayment
    ? null
    : Array.isArray(rawPayment)
      ? (rawPayment[0] ?? null)
      : rawPayment;

  const initial: InitialPrediction = {
    id: p.id,
    name: p.prediction_name,
    totalGoals: p.total_goals,
    championTeamId: p.champion_team_id,
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

  return (
    <PredictionsPageContent
      mode="edit"
      predictionId={id}
      initial={initial}
      breadcrumb={
        <AdminBreadcrumb
          items={[
            { label: 'My Predictions', href: ROUTES.predictions },
            { label: p.prediction_name },
          ]}
        />
      }
    />
  );
}
