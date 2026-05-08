'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Clock, Trophy, Users, UserPlus, Target, Award, ChevronRight } from 'lucide-react';

import { PageLayout } from '@/components/layout/PageLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { SCORING, ROUTES, TOURNAMENT_CONFIG } from '@/lib/constants';
import type { TournamentInfo } from '@/types/tournament';

interface TournamentResponse {
  id: string;
  slug: string;
  name: string;
  status: TournamentInfo['status'];
  lockTime: string;
  totalEntries: number;
}

function formatTimeRemaining(lockTime: Date): string {
  const now = new Date();
  const diff = lockTime.getTime() - now.getTime();
  if (diff <= 0) return 'Predictions locked';
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function getStatusBadge(status: TournamentInfo['status']) {
  switch (status) {
    case 'upcoming':
      return <Badge variant="secondary">Upcoming</Badge>;
    case 'group_stage':
      return <Badge className="bg-green-500 hover:bg-green-600">Group Stage</Badge>;
    case 'knockout':
      return <Badge className="bg-green-500 hover:bg-green-600">Knockout</Badge>;
    case 'completed':
      return <Badge variant="outline">Completed</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export function HomePageContent() {
  const query = useQuery<TournamentResponse>({
    queryKey: ['tournament'],
    queryFn: async () => {
      const res = await fetch('/api/tournament');
      if (!res.ok) throw new Error('Failed to fetch tournament');
      return res.json();
    },
  });

  const tournament = query.data;
  const lockTime = tournament ? new Date(tournament.lockTime) : null;

  return (
    <PageLayout>
      <section className="py-12 text-center md:py-20">
        <Badge variant="outline" className="mb-4">
          FIFA World Cup 2026
        </Badge>
        <h1 className="mb-4 text-4xl font-bold tracking-tight md:text-6xl">
          World Cup 2026
          <br />
          <span className="text-primary">Prediction Game</span>
        </h1>
        <p className="text-muted-foreground mx-auto mb-8 max-w-2xl text-lg md:text-xl">
          Submit your bracket predictions, earn points for correct picks, and climb the leaderboard.
          Free to play — all you need is a username.
        </p>
        <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Button asChild size="lg" className="min-w-[200px]">
            <Link href={ROUTES.register}>
              Create an account
              <ChevronRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="min-w-[200px]">
            <Link href={ROUTES.leaderboard}>View Leaderboard</Link>
          </Button>
        </div>
      </section>

      <section className="py-12">
        <h2 className="mb-8 text-center text-2xl font-bold md:text-3xl">Tournament Overview</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Target className="h-4 w-4" />
                Status
              </CardDescription>
            </CardHeader>
            <CardContent>
              {query.isLoading ? (
                <Skeleton className="h-6 w-24" />
              ) : tournament ? (
                getStatusBadge(tournament.status)
              ) : (
                <Badge variant="outline">—</Badge>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Total Entries
              </CardDescription>
            </CardHeader>
            <CardContent>
              {query.isLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <p className="text-2xl font-bold">
                  {(tournament?.totalEntries ?? 0).toLocaleString()}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Lock Time
              </CardDescription>
            </CardHeader>
            <CardContent>
              {query.isLoading ? (
                <Skeleton className="h-8 w-32" />
              ) : (
                <p className="text-2xl font-bold">
                  {lockTime ? formatTimeRemaining(lockTime) : '—'}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="py-12">
        <h2 className="mb-8 text-center text-2xl font-bold md:text-3xl">How It Works</h2>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card className="relative overflow-hidden">
            <div className="bg-primary/10 text-primary absolute top-4 left-4 flex h-8 w-8 items-center justify-center rounded-full font-bold">
              1
            </div>
            <CardHeader className="pt-14">
              <UserPlus className="text-primary mb-2 h-8 w-8" />
              <CardTitle>Create an account</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Sign up with a username, email, and password. Takes under a minute.
              </p>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden">
            <div className="bg-primary/10 text-primary absolute top-4 left-4 flex h-8 w-8 items-center justify-center rounded-full font-bold">
              2
            </div>
            <CardHeader className="pt-14">
              <Target className="text-primary mb-2 h-8 w-8" />
              <CardTitle>Make Predictions</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Predict group stage standings (1st–4th) for all {TOURNAMENT_CONFIG.totalGroups}{' '}
                groups and complete the knockout bracket.
              </p>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden">
            <div className="bg-primary/10 text-primary absolute top-4 left-4 flex h-8 w-8 items-center justify-center rounded-full font-bold">
              3
            </div>
            <CardHeader className="pt-14">
              <Award className="text-primary mb-2 h-8 w-8" />
              <CardTitle>Earn Points</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Earn points for correct predictions. Group stage and knockout matches have different
                point values.
              </p>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden">
            <div className="bg-primary/10 text-primary absolute top-4 left-4 flex h-8 w-8 items-center justify-center rounded-full font-bold">
              4
            </div>
            <CardHeader className="pt-14">
              <Trophy className="text-primary mb-2 h-8 w-8" />
              <CardTitle>Climb the ranks</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Watch your rank rise on the leaderboard as the tournament unfolds.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

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

      <section className="py-12">
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="flex flex-col items-center gap-6 py-12 text-center">
            <Trophy className="text-primary h-16 w-16" />
            <div>
              <h2 className="mb-2 text-2xl font-bold md:text-3xl">Ready to Compete?</h2>
              <p className="text-muted-foreground mx-auto max-w-lg">
                Create an account and submit your bracket. The leaderboard updates as results come
                in.
              </p>
            </div>
            <Button asChild size="lg" className="min-w-[250px]">
              <Link href={ROUTES.register}>
                Create an account
                <ChevronRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    </PageLayout>
  );
}
