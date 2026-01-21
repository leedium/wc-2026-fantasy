import type { Metadata } from 'next';

import { PredictionsPageContent } from './PredictionsPageContent';

export const metadata: Metadata = {
  title: 'Make Your Predictions | World Cup 2026',
  description:
    'Submit your bracket predictions for the FIFA World Cup 2026. Predict group stage standings, knockout bracket winners, and total tournament goals.',
};

export default function PredictionsPage() {
  return <PredictionsPageContent />;
}
