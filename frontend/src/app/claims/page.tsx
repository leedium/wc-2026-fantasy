import type { Metadata } from 'next';

import { ClaimsPageContent } from './ClaimsPageContent';

export const metadata: Metadata = {
  title: 'Claim Prizes | World Cup 2026',
  description:
    'Claim your share of the World Cup 2026 Prediction Game prize pool. Prize distribution available after the tournament ends.',
};

export default function ClaimsPage() {
  return <ClaimsPageContent />;
}
