import type { Metadata } from 'next';

import { PredictionsPageContent } from '@/app/predictions/PredictionsPageContent';
import { AdminBreadcrumb } from '@/components/admin/AdminBreadcrumb';
import { getServerSupabase } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'New Prediction | Admin',
};

export default async function AdminNewPredictionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await getServerSupabase();
  const { data: profile } = await supabase
    .from('profiles')
    .select('username, display_name')
    .eq('id', id)
    .maybeSingle();

  const userLabel =
    (profile?.display_name as string | null) ||
    (profile?.username as string | null) ||
    'User';

  return (
    <PredictionsPageContent
      mode="create"
      apiBasePath={`/api/admin/users/${id}/predictions`}
      redirectAfterSave={`/admin/users/${id}`}
      breadcrumb={
        <AdminBreadcrumb
          items={[
            { label: 'Users', href: '/admin/users' },
            { label: userLabel, href: `/admin/users/${id}` },
            { label: 'New prediction' },
          ]}
        />
      }
    />
  );
}
