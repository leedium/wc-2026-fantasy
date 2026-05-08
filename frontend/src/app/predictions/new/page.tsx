import type { Metadata } from 'next';

import { PredictionsPageContent } from '../PredictionsPageContent';

export const metadata: Metadata = {
  title: 'New Prediction | World Cup 2026',
};

export default function NewPredictionPage() {
  return <PredictionsPageContent mode="create" />;
}
