import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowRight } from 'lucide-react';

import { PageLayout } from '@/components/layout/PageLayout';
import { PrizeTables } from '@/components/shared/PrizeTables';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/lib/constants';
import { getServerSupabase } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Prizes | World Cup 2026',
  description:
    'Cash prizes for the World Cup 2026 Prediction Game — Phase 1 (group stage) rewards the top 3 and Phase 2 (knockout) rewards the top 5.',
};

export default async function PrizesPage() {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`${ROUTES.login}?next=${encodeURIComponent(ROUTES.prizes)}`);
  }

  return (
    <PageLayout>
      <section className="py-12 text-center md:py-16">
        <Badge variant="outline" className="mb-4">
          Prizes
        </Badge>
        <h1 className="mb-4 text-3xl font-bold tracking-tight md:text-5xl">Prizes</h1>
        <p className="text-muted-foreground mx-auto max-w-2xl text-lg">
          Two separate payouts. Phase 1 rewards the top of the group-stage standings, and
          Phase 2 rewards the final knockout standings — your entry is in the running for both.
        </p>
      </section>

      <section className="pb-8">
        <PrizeTables />
      </section>

      <div className="flex justify-center">
        <Button variant="outline" asChild>
          <Link href={ROUTES.leaderboard}>
            View the leaderboard
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>
    </PageLayout>
  );
}
