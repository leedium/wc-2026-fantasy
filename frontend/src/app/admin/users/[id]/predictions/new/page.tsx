import type { Metadata } from 'next';

import { PredictionsPageContent } from '@/app/predictions/PredictionsPageContent';

export const metadata: Metadata = {
  title: 'New Prediction | Admin',
};

export default async function AdminNewPredictionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <PredictionsPageContent
      mode="create"
      apiBasePath={`/api/admin/users/${id}/predictions`}
      redirectAfterCreate={() => `/admin/users/${id}`}
    />
  );
}
