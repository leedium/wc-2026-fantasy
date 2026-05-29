import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, ExternalLink } from 'lucide-react';

import { PageLayout } from '@/components/layout/PageLayout';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { CHARITIES, PRICING } from '@/lib/constants';

export const metadata: Metadata = {
  title: 'Charities | World Cup 2026',
  description:
    'Part of every entry goes to charity. This tournament we’re donating to the Canadian Cancer Society and Islamic Relief Canada.',
};

export default function CharitiesPage() {
  return (
    <PageLayout>
      <section className="py-12 text-center md:py-16">
        <Badge variant="outline" className="mb-4">
          Charities
        </Badge>
        <h1 className="mb-4 text-3xl font-bold tracking-tight md:text-5xl">
          Charitable <span className="text-primary">Donations</span>
        </h1>
        <p className="text-muted-foreground mx-auto max-w-2xl text-lg">
          ${PRICING.charityPortionCAD} {PRICING.currency} from every ${PRICING.entryFeeCAD}{' '}
          {PRICING.currency} entry is set aside for charity. This year, the pool is supporting
          two causes that matter to us.
        </p>
      </section>

      <section className="pb-16">
        <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-2">
          {CHARITIES.map((charity) => (
            <Card key={charity.slug} className="flex flex-col">
              <CardHeader>
                <div className="border-border mb-4 flex h-32 items-center justify-center rounded-lg border bg-white p-4">
                  <Image
                    src={charity.logo}
                    alt={`${charity.name} logo`}
                    width={240}
                    height={96}
                    className="max-h-24 w-auto object-contain"
                  />
                </div>
                <CardTitle className="text-xl">{charity.name}</CardTitle>
                <CardDescription>{charity.tagline}</CardDescription>
              </CardHeader>
              <CardContent className="flex-1" />
              <CardFooter className="flex flex-wrap items-center justify-between gap-3">
                <Link
                  href={`/charities/${charity.slug}`}
                  className="text-primary inline-flex items-center gap-1 text-sm font-medium hover:underline"
                >
                  Learn more
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <a
                  href={charity.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
                >
                  Visit {charity.displayUrl}
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </CardFooter>
            </Card>
          ))}
        </div>
      </section>
    </PageLayout>
  );
}
