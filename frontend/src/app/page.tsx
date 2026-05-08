import { redirect } from 'next/navigation';

import { getServerSupabase } from '@/lib/supabase/server';
import { ROUTES } from '@/lib/constants';
import { HomePageContent } from './HomePageContent';

export default async function HomePage() {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect(ROUTES.predictions);
  return <HomePageContent />;
}
