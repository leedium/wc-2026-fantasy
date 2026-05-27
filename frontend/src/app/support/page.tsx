import type { Metadata } from 'next';

import { PageLayout } from '@/components/layout/PageLayout';
import { SupportForm } from './SupportForm';
import { UserTicketsList } from './UserTicketsList';

export const metadata: Metadata = {
  title: 'Support | World Cup 2026',
};

export default function SupportPage() {
  return (
    <PageLayout>
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-bold">Contact support</h1>
        <p className="text-muted-foreground">
          Hit a snag with your account, a payment, or your predictions? Send us a
          ticket and we&apos;ll get back to you by email.
        </p>
      </div>
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <SupportForm />
        </div>
        <div className="lg:col-span-2">
          <UserTicketsList />
        </div>
      </div>
    </PageLayout>
  );
}
