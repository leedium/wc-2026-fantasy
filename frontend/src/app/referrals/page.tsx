import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { getServerSupabase } from '@/lib/supabase/server';
import { ROUTES } from '@/lib/constants';
import { ReferralsPageContent } from './ReferralsPageContent';

export const metadata: Metadata = {
  title: 'Refer a friend — WC2026',
};

export default async function ReferralsPage() {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`${ROUTES.login}?next=${encodeURIComponent(ROUTES.referrals)}`);
  }
  return <ReferralsPageContent />;
}
