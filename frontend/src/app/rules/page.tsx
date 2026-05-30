import type { Metadata } from 'next';

import { PageLayout } from '@/components/layout/PageLayout';
import { ScoringBreakdown } from '@/components/marketing/ScoringBreakdown';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PRICING } from '@/lib/constants';

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
                    Up to five named predictions.
                  </span>{' '}
                  Each account can save as many as five separate predictions per tournament.
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
                  <span className="text-foreground font-semibold">
                    Contact the pool organizer.
                  </span>{' '}
                  Reach out to arrange payment. An admin marks each prediction as paid
                  before lock; only paid predictions appear on the leaderboard.
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
              <li>
                <span className="text-foreground font-semibold">Between the two locks.</span>{' '}
                Your group picks, advancers, Gut Feeling Champion, and prediction name stay
                frozen — only your knockout bracket and tiebreaker remain editable.
              </li>
            </ul>
          </CardContent>
        </Card>
      </section>
    </PageLayout>
  );
}
