import { HeartHandshake } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PRICING } from '@/lib/constants';

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
            {PRICING.currency} for a charity the pool organizer announces before
            lock.
          </p>
          <p>
            Final partner, running total, and impact updates will be published
            here. Stay tuned.
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
