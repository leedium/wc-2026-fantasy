import type { Metadata } from 'next';

import { AuditPageContent } from './AuditPageContent';

export const metadata: Metadata = {
  title: 'Audit | World Cup 2026',
  description:
    'Transparent, real-time accounting for the World Cup 2026 Prediction Game: members, paid entries, charity, operating costs, and net payout.',
};

export default function AuditPage() {
  return <AuditPageContent />;
}
