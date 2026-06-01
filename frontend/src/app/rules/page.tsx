import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

import { PageLayout } from '@/components/layout/PageLayout';
import { ScoringBreakdown } from '@/components/marketing/ScoringBreakdown';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PRICING, ROUTES, SCORING } from '@/lib/constants';

export const metadata: Metadata = {
  title: 'Rules | World Cup 2026',
  description:
    'Game rules and scoring breakdown for the World Cup 2026 Prediction Game — predictions, lock time, payment, leaderboard, and how points are calculated.',
};

export default function RulesPage() {
  return (
    <PageLayout>
      <section className="py-12 text-center md:py-16">
        <Badge variant="outline" className="mb-4">
          Rules
        </Badge>
        <h1 className="mb-4 text-3xl font-bold tracking-tight md:text-5xl">Game Rules</h1>
        <p className="text-muted-foreground mx-auto max-w-2xl text-lg">
          Everything you need to know to play — what you predict, when it locks, and exactly
          how points are awarded.
        </p>
      </section>

      <section className="py-8">
        <Card>
          <CardHeader>
            <CardTitle>How the two phases work</CardTitle>
            <CardDescription>
              Predictions are made and scored across two separately-locked phases.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 text-sm">
              <p className="text-muted-foreground">
                <span className="text-foreground font-semibold">Phase 1 — Before kickoff.</span>{' '}
                Predict group standings (1st–4th in all 12 groups), rank your 8 best third-place
                advancers, and pick your Gut Feeling Champion. Locks at the opening match.{' '}
                <span className="text-foreground font-medium">
                  Up to{' '}
                  {SCORING.maxGroupPoints +
                    SCORING.maxAdvancerPoints +
                    SCORING.championPickBonus}{' '}
                  points.
                </span>
              </p>
              <p className="text-muted-foreground">
                <span className="text-foreground font-semibold">Phase 2 — The knockouts.</span>{' '}
                Once the group results are in and the bracket is set, predict every match winner
                from the Round of 32 through the Final, plus the third-place match, and set your
                Champion&apos;s Total Playoff Goals tiebreaker. Locks before the Round of 32.{' '}
                <span className="text-foreground font-medium">
                  Up to {SCORING.maxKnockoutPoints} points.
                </span>
              </p>
              <p className="text-muted-foreground">
                Together they total a maximum of{' '}
                <span className="text-foreground font-semibold">
                  {SCORING.maxTotalPoints} points
                </span>
                .
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="py-8">
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>How predictions work</CardTitle>
              <CardDescription>The basics of submitting a bracket.</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="text-muted-foreground space-y-3 text-sm">
                <li>
                  <span className="text-foreground font-semibold">Account required.</span>{' '}
                  You need a registered account to submit predictions.
                </li>
                <li>
                  <span className="text-foreground font-semibold">
                    Multiple named predictions.
                  </span>{' '}
                  Each account can save as many separate predictions per tournament as you like.
                  Each has its own name, picks, and tiebreaker.
                </li>
                <li>
                  <span className="text-foreground font-semibold">Edit until lock.</span> Any
                  prediction can be edited (or deleted, if unpaid) right up until the relevant
                  phase deadline — see <span className="font-semibold">Lock times</span> below.
                </li>
                <li>
                  <span className="text-foreground font-semibold">Gut Feeling Champion.</span>{' '}
                  Before the tournament begins, select the team you think will win the tournament. This pick locks at kickoff of the opening match.
                  Once the playoffs begin, you may submit a new Champion Pick.
                  <p>Bonus: You will earn +5 points if this Original Pick wins the tournament. See <span className="font-semibold">Scoring Breakdown</span> below.</p>
                </li>
                <li>
                  <span className="text-foreground font-semibold">
                    Independently scored.
                  </span>{' '}
                  Predictions don&apos;t combine. Each one is scored and ranked on its own —
                  if you have several, each one occupies its own leaderboard row.
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Leaderboard eligibility</CardTitle>
              <CardDescription>What gets you onto the public leaderboard.</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="text-muted-foreground space-y-3 text-sm">
                <li>
                  <span className="text-foreground font-semibold">Per-prediction entry.</span>{' '}
                  Each prediction costs{' '}
                  <span className="text-foreground font-semibold">
                    ${PRICING.entryFeeCAD} {PRICING.currency}
                  </span>{' '}
                  and is its own entry. A single account can have multiple ranks if it has
                  multiple paid predictions.
                </li>
                <li>
                  <span className="text-foreground font-semibold">Payment</span>
                  <br />
                  E-transfer:{' '}
                  <a href="mailto:payments@soccer-pool.com" className="text-foreground font-medium">
                    payments@soccer-pool.com
                  </a>
                  <br />
                  PayPal also accepted &mdash; email for info
                  <br />
                  <br />
                  Please include your username in the payment notes.
                </li>
                <li>
                  <span className="text-foreground font-semibold">Unpaid still saves.</span>{' '}
                  You can still create and edit unpaid predictions; they just won&apos;t be
                  scored on the public ranking.
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="py-8">
        <Card>
          <CardHeader>
            <CardTitle>Charity contribution</CardTitle>
            <CardDescription>Where part of every entry goes.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">
              <span className="text-foreground font-semibold">
                ${PRICING.charityPortionCAD} {PRICING.currency}
              </span>{' '}
              from every{' '}
              <span className="text-foreground font-semibold">
                ${PRICING.entryFeeCAD} {PRICING.currency}
              </span>{' '}
              entry is set aside for charity. The pool organizer will announce the
              chosen charity before the tournament locks.
            </p>
          </CardContent>
        </Card>
      </section>

      <ScoringBreakdown />

      <section className="py-8">
        <Card>
          <CardHeader>
            <CardTitle>Lock times</CardTitle>
            <CardDescription>Two deadlines — one for each phase.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4 text-sm">
              Predictions lock in two phases. Until each phase&apos;s deadline you can adjust
              those picks as often as you like; once it passes, they&apos;re frozen for scoring.
            </p>
            <ul className="text-muted-foreground space-y-3 text-sm">
              <li>
                <span className="text-foreground font-semibold">
                  Phase 1 — Group Stage lock.
                </span>{' '}
                Freezes your group standings (1st–4th in all 12 groups), your Best 3rds
                advancer ranking, and your Gut Feeling Champion. Your prediction name locks
                here too, and no new predictions can be created after this deadline.
              </li>
              <li>
                <span className="text-foreground font-semibold">
                  Phase 2 — Knockout lock.
                </span>{' '}
                Opens once the group results are in and the bracket is set. Until it passes
                you can still edit your knockout bracket (Round of 32 through the Final,
                including the third-place match) and your Champion&apos;s Total Playoff Goals
                tiebreaker. After it locks, every pick is frozen.
              </li>
            </ul>
          </CardContent>
        </Card>
      </section>

      <section className="py-8">
        <Card>
          <CardHeader>
            <CardTitle>Transparency &amp; audit</CardTitle>
            <CardDescription>See exactly where the money goes.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4 text-sm">
              We keep a live audit page open to every member: total members, paid entries, the
              charity contribution ({PRICING.charityPortionCAD} {PRICING.currency} of every entry),
              the full operating-cost breakdown, and the resulting net payout. Nothing is hidden —
              the figures update in real time as entries are paid.
            </p>
            <Button asChild>
              <Link href={ROUTES.audit}>
                View the audit page
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    </PageLayout>
  );
}
