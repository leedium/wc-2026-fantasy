import type { Metadata } from 'next';

import { LeaderboardPageContent } from './LeaderboardPageContent';

export const metadata: Metadata = {
  title: 'Leaderboard | World Cup 2026',
  description:
    'View the World Cup 2026 Prediction Game leaderboard. See rankings, points, and track your position against other players.',
};

export default function LeaderboardPage() {
  return <LeaderboardPageContent />;
}
