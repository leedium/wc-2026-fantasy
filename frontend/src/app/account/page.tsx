import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { getServerSupabase } from '@/lib/supabase/server';
import { ROUTES } from '@/lib/constants';
import { AccountForm } from './AccountForm';

export const metadata: Metadata = {
  title: 'Account | World Cup 2026',
};

export default async function AccountPage() {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`${ROUTES.login}?next=${encodeURIComponent(ROUTES.account)}`);

  const { data: profile } = await supabase
    .from('profiles')
    .select('username, display_name')
    .eq('id', user.id)
    .maybeSingle();

  return (
    <AccountForm
      email={user.email ?? ''}
      initialUsername={(profile?.username as string | undefined) ?? ''}
      initialDisplayName={(profile?.display_name as string | null | undefined) ?? ''}
    />
  );
}
