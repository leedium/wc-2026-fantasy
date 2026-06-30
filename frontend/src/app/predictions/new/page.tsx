import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { getServerSupabase } from '@/lib/supabase/server';
import { shouldRedirectLockedPrediction } from '@/lib/tournament/lockGate';
import { ROUTES } from '@/lib/constants';
import { PredictionsPageContent } from '../PredictionsPageContent';

export const metadata: Metadata = {
  title: 'New Prediction | World Cup 2026',
};

export default async function NewPredictionPage() {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`${ROUTES.login}?next=${encodeURIComponent(ROUTES.predictions)}`);

  // While the tournament is locked, no new predictions can be created — redirect
  // deeplinks back to the hub. Super admins keep access (they can still create).
  if (await shouldRedirectLockedPrediction(user.id)) redirect(ROUTES.predictions);

  return <PredictionsPageContent mode="create" />;
}
