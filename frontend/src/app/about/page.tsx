import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

import { PageLayout } from '@/components/layout/PageLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PRICING, ROUTES } from '@/lib/constants';

export const metadata: Metadata = {
  title: 'About | World Cup 2026',
  description:
    "The story behind soccer-pool.com — how a 30-year-old friend group's prediction tradition became an online pool, and how we're using it to give back.",
};

export default function AboutPage() {
  return (
    <PageLayout>
      <section className="py-12 text-center md:py-16">
        <Badge variant="outline" className="mb-4">
          About
        </Badge>
        <h1 className="mb-4 text-3xl font-bold tracking-tight md:text-5xl">
          Our <span className="text-primary">Story</span>
        </h1>
        <p className="text-muted-foreground mx-auto max-w-2xl text-lg">
          Three decades of friendly arguments, predictions, and bragging rights — now with
          a way to give back.
        </p>
      </section>

      <section className="py-8">
        <h2 className="mb-8 text-center text-2xl font-bold md:text-3xl">How it started</h2>
        <div className="text-muted-foreground mx-auto max-w-3xl space-y-4 text-base leading-relaxed">
          <p>
            My love for sports goes back as far as I can remember. Growing up, soccer was
            always part of the conversation — especially during the World Cup and Euro
            tournaments. Back in high school (over 30 years ago!) my friends and I would
            spend hours debating which country was the best and predicting who would win it
            all.
          </p>
          <p>
            What started as friendly arguments eventually turned into a small prediction
            pool between 10–15 friends using nothing more than pen and paper. Every two
            years, the pool would return, and each tournament brought more people into the
            fun. As the group grew, I moved everything into Excel to help automate the
            scoring and keep track of everyone&rsquo;s predictions.
          </p>
          <p>
            Later, while attending university, I met my friend David, who shared an
            interest in web design and development. Together, we created soccer-pool.com to
            make it easier for people to join pools, submit predictions, and follow their
            scores throughout the tournament.
          </p>
          <p>
            At its core, this has always been about bringing people together. The pool
            gives everyone something extra to cheer for during the tournament — along with
            a little friendly competition and bragging rights between friends. For me
            personally, it has also become a great way to reconnect with people every
            couple of years when the next tournament comes around.
          </p>
          <p>
            This year, we decided to take things one step further by using the platform to
            help support charities and causes that are meaningful to us. It&rsquo;s our way
            of giving back while continuing to bring people together through the game we
            all love.
          </p>
        </div>
      </section>

      <section className="py-12">
        <Card className="mx-auto max-w-3xl">
          <CardHeader>
            <CardTitle>Charitable Donations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-muted-foreground text-sm">
              ${PRICING.charityPortionCAD} {PRICING.currency} from every ${PRICING.entryFeeCAD}{' '}
              {PRICING.currency} entry goes to charity. This year, the pool is supporting two
              causes that matter to us.
            </p>
            <Link
              href={ROUTES.charities}
              className="text-primary inline-flex items-center gap-1 text-sm font-medium hover:underline"
            >
              See the charities we&rsquo;re supporting
              <ArrowRight className="h-4 w-4" />
            </Link>
          </CardContent>
        </Card>
      </section>
    </PageLayout>
  );
}
