import type { Metadata } from 'next';

import { PredictionsListPage } from './PredictionsListPage';

export const metadata: Metadata = {
  title: 'Your Predictions | World Cup 2026',
  description: 'Manage your World Cup 2026 bracket predictions.',
};

export default function PredictionsIndexPage() {
  return <PredictionsListPage />;
}
