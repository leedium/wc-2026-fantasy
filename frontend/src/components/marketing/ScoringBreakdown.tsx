import { Trophy, Users, Target } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SCORING, TOURNAMENT_CONFIG } from '@/lib/constants';

export function ScoringBreakdown() {
  return (
    <section className="py-12">
      <h2 className="mb-8 text-center text-2xl font-bold md:text-3xl">Scoring Breakdown</h2>
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="text-primary h-5 w-5" />
              Group Stage
            </CardTitle>
            <CardDescription>
              Scored on the top two finishers in each of the {TOURNAMENT_CONFIG.totalGroups}{' '}
              groups
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Both top 2, exact order</span>
                <span className="font-semibold">+6 points</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Both top 2, swapped</span>
                <span className="font-semibold">+4 points</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">One correct, in correct slot</span>
                <span className="font-semibold">+3 points</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">One correct, in wrong slot</span>
                <span className="font-semibold">+2 points</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">None correct</span>
                <span className="font-semibold">+0 points</span>
              </div>
              <div className="bg-muted/50 rounded-md p-3 text-sm">
                <span className="font-semibold">Group of Death (Group I):</span>{' '}
                <span className="text-muted-foreground">
                  Both top 2 in exact order pays <span className="font-semibold">+8</span> instead
                  of +6.
                </span>
              </div>
              <div className="border-t pt-3">
                <div className="flex items-center justify-between font-semibold">
                  <span>Maximum Group Points</span>
                  <span className="text-primary">{SCORING.maxGroupPoints} pts</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="text-primary h-5 w-5" />
              Knockout Stage
            </CardTitle>
            <CardDescription>
              Each round, every team that advances scores you points — more if you had them in
              the right slot.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">
                  Round of 16{' '}
                  <span className="text-muted-foreground/70 text-xs">(per team advancing)</span>
                </span>
                <span className="font-semibold whitespace-nowrap">+5 / +3 pts</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">
                  Quarter-finals{' '}
                  <span className="text-muted-foreground/70 text-xs">(per team advancing)</span>
                </span>
                <span className="font-semibold whitespace-nowrap">+6 / +3 pts</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">
                  Semi-finals{' '}
                  <span className="text-muted-foreground/70 text-xs">(per team advancing)</span>
                </span>
                <span className="font-semibold whitespace-nowrap">+8 / +4 pts</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">
                  Final{' '}
                  <span className="text-muted-foreground/70 text-xs">(per finalist)</span>
                </span>
                <span className="font-semibold whitespace-nowrap">+10 / +5 pts</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Third Place Match Winner</span>
                <span className="font-semibold">+5 pts</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">World Cup Champion</span>
                <span className="font-semibold">+15 pts</span>
              </div>
              <div className="bg-muted/50 rounded-md p-3 text-xs">
                <span className="font-semibold">Correct slot vs. wrong slot:</span>{' '}
                <span className="text-muted-foreground">
                  Correct slot = the team advanced from the bracket match you predicted. Wrong
                  slot = the team advanced, but from a different match in the same round.
                </span>
              </div>
              <div className="bg-muted/50 rounded-md p-3 text-xs">
                <span className="font-semibold">Round of 32:</span>{' '}
                <span className="text-muted-foreground">
                  Picks aren&apos;t scored on their own — they decide which teams sit in your
                  Round-of-16 slots.
                </span>
              </div>
              <div className="border-t pt-3">
                <div className="flex items-center justify-between font-semibold">
                  <span>Maximum Knockout Points</span>
                  <span className="text-primary">{SCORING.maxKnockoutPoints} pts</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="text-primary h-5 w-5" />
            Best 3rd-Place Advancers
          </CardTitle>
          <CardDescription>
            FIFA 2026 advances 8 of the 12 group third-place teams to the Round of 32. Pick
            8 teams from your group-stage 3rd-place predictions and rank them — best first.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">
                Team in the actual top 8 (any rank)
              </span>
              <span className="font-semibold">+1 pt</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Team at the exact correct rank</span>
              <span className="font-semibold">+0.25 pts</span>
            </div>
            <div className="bg-muted/50 rounded-md p-3 text-xs">
              <span className="font-semibold">Bonuses stack:</span>{' '}
              <span className="text-muted-foreground">
                a team in the correct rank earns the full <span className="font-semibold">
                  +1.25
                </span>{' '}
                (set + rank).
              </span>
            </div>
            <div className="border-t pt-3">
              <div className="flex items-center justify-between font-semibold">
                <span>Maximum Advancer Points</span>
                <span className="text-primary">{SCORING.maxAdvancerPoints} pts</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardContent className="flex flex-col items-center justify-between gap-4 py-6 sm:flex-row">
          <div>
            <p className="text-muted-foreground text-sm">Tiebreaker</p>
            <p className="font-medium">
              Predict the total goals scored by the World Cup champion across all 8 of their
              tournament matches. Closest to actual wins.
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              Regulation and extra time only — penalty-shootout goals don&apos;t count.
            </p>
          </div>
          <div className="text-center sm:text-right">
            <p className="text-muted-foreground text-sm">Maximum Total Points</p>
            <p className="text-primary text-3xl font-bold">{SCORING.maxTotalPoints}</p>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
