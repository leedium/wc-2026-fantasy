import Link from 'next/link';
import { ArrowRight, HeartHandshake } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PRICING, ROUTES } from '@/lib/constants';

export function DonationsToCharity() {
  return (
    <section className="py-12">
      <h2 className="mb-8 text-center text-2xl font-bold md:text-3xl">
        Donations to Charity
      </h2>
      <Card className="mx-auto max-w-3xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HeartHandshake className="h-5 w-5" />
            ${PRICING.charityPortionCAD} {PRICING.currency} from every entry
          </CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground space-y-3 text-sm">
          <p>
            Each prediction sets aside ${PRICING.charityPortionCAD}{' '}
            {PRICING.currency} for charity. This year, the pool is supporting
            two causes that matter to us.
          </p>
          <Link
            href={ROUTES.charities}
            className="text-primary inline-flex items-center gap-1 text-sm font-medium hover:underline"
          >
            Meet our two charity partners
            <ArrowRight className="h-4 w-4" />
          </Link>
        </CardContent>
      </Card>
    </section>
  );
}
