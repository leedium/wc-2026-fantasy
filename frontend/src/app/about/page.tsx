import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronRight, ClipboardList, Trophy, UserPlus, Users } from 'lucide-react';

import { PageLayout } from '@/components/layout/PageLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ROUTES, TOURNAMENT_CONFIG } from '@/lib/constants';

export const metadata: Metadata = {
  title: 'About | World Cup 2026',
  description:
    'About the World Cup 2026 Prediction Game — submit bracket predictions, earn points for correct picks, and climb the leaderboard.',
};

export default function AboutPage() {
  return (
    <PageLayout>
      <section className="py-12 text-center md:py-16">
        <Badge variant="outline" className="mb-4">
          About
        </Badge>
        <h1 className="mb-4 text-3xl font-bold tracking-tight md:text-5xl">
          About the <span className="text-primary">Prediction Game</span>
        </h1>
        <p className="text-muted-foreground mx-auto max-w-2xl text-lg">
          A friendly bracket-prediction game for the FIFA World Cup 2026. Lock in your picks
          before kickoff, watch results roll in, and see how your bracket stacks up against
          everyone else&apos;s.
        </p>
      </section>

      <section className="py-8">
        <h2 className="mb-8 text-center text-2xl font-bold md:text-3xl">How it works</h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader>
              <UserPlus className="text-primary mb-2 h-8 w-8" />
              <CardTitle>1. Create an account</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">
                Sign up with an email and password. We&apos;ll generate a username you can
                change later from your account page.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <ClipboardList className="text-primary mb-2 h-8 w-8" />
              <CardTitle>2. Submit predictions</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">
                Pick group standings, fill in the knockout bracket, and set your tiebreaker.
                You can save up to five named predictions and edit any of them until lock.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Users className="text-primary mb-2 h-8 w-8" />
              <CardTitle>3. Results post</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">
                As matches finish, the admin posts the real-world results and points are
                awarded automatically for each of your predictions.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Trophy className="text-primary mb-2 h-8 w-8" />
              <CardTitle>4. Climb the leaderboard</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">
                Every prediction is its own leaderboard entry. The closer you are to the
                actual results, the higher you rank.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="py-12">
        <Card>
          <CardHeader>
            <CardTitle>What you predict</CardTitle>
            <CardDescription>
              Three layers, all submitted before a single tournament-wide lock time.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="text-muted-foreground space-y-3 text-sm">
              <li>
                <span className="text-foreground font-semibold">Group stage standings.</span>{' '}
                Rank teams 1st through 4th for all {TOURNAMENT_CONFIG.totalGroups} groups, plus
                pick eight teams from your 3rd-place picks to be the best 3rd-place advancers.
              </li>
              <li>
                <span className="text-foreground font-semibold">Knockout bracket.</span> Pick a
                winner for every match from the Round of 32 through the final, including the
                third-place match.
              </li>
              <li>
                <span className="text-foreground font-semibold">Tiebreaker.</span> Predict the
                total goals scored by the eventual champion across their eight tournament
                matches (regulation + extra time only).
              </li>
            </ul>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild>
                <Link href={ROUTES.rules}>
                  Read the full rules
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={ROUTES.register}>Create an account</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>
    </PageLayout>
  );
}
