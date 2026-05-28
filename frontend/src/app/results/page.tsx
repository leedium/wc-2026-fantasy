import type { Metadata } from 'next';

import { ResultsPageContent } from './ResultsPageContent';

export const metadata: Metadata = {
  title: 'Results | World Cup 2026',
  description:
    'Live tournament results: group standings, the best 3rd-place advancers, and the knockout bracket exactly as entered by the pool admin.',
};

export default function ResultsPage() {
  return <ResultsPageContent />;
}
