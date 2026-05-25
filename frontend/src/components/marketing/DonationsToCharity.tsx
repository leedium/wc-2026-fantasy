import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, HeartHandshake } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CHARITIES, PRICING, ROUTES } from '@/lib/constants';

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
        <CardContent className="text-muted-foreground space-y-6 text-sm">
          <p>
            Each prediction sets aside ${PRICING.charityPortionCAD}{' '}
            {PRICING.currency} for charity. This year, the pool is supporting
            two causes that matter to us.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {CHARITIES.map((charity) => (
              <div
                key={charity.slug}
                className="bg-muted/20 rounded-lg border p-4"
              >
                <div className="bg-background mb-3 flex h-20 items-center justify-center rounded p-2">
                  <Image
                    src={charity.logo}
                    alt={`${charity.name} logo`}
                    width={160}
                    height={64}
                    className="max-h-16 w-auto object-contain"
                  />
                </div>
                <div className="text-foreground text-sm font-semibold">
                  {charity.name}
                </div>
                <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                  {charity.tagline}
                </p>
              </div>
            ))}
          </div>
          <div className="text-center">
            <Link
              href={ROUTES.charities}
              className="text-primary inline-flex items-center gap-1 text-sm font-medium hover:underline"
            >
              Meet our two charity partners
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
