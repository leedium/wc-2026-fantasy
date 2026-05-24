import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { getServerSupabase } from '@/lib/supabase/server';
import { ROUTES } from '@/lib/constants';
import { RewardsPageContent } from './RewardsPageContent';

export const metadata: Metadata = {
  title: 'Rewards — soccer-pool 2026',
};

export default async function RewardsPage() {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`${ROUTES.login}?next=${encodeURIComponent(ROUTES.rewards)}`);
  }
  return <RewardsPageContent />;
}
