'use client';

import Link from 'next/link';
import { Clock, Trophy, Users, Wallet, Target, Award, ChevronRight, Coins } from 'lucide-react';

import { PageLayout } from '@/components/layout/PageLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { mockTournamentInfo } from '@/lib/mock-data';
import { ENTRY_FEE_SOL, SCORING, ROUTES, TOURNAMENT_CONFIG } from '@/lib/constants';

// Helper to format time remaining
function formatTimeRemaining(lockTime: Date): string {
  const now = new Date();
  const diff = lockTime.getTime() - now.getTime();

  if (diff <= 0) return 'Predictions locked';

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

// Helper to format status
function getStatusBadge(status: string) {
  switch (status) {
    case 'upcoming':
      return <Badge variant="secondary">Upcoming</Badge>;
    case 'active':
      return <Badge className="bg-green-500 hover:bg-green-600">Live</Badge>;
    case 'completed':
      return <Badge variant="outline">Completed</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export default function Home() {
  const { status, lockTime, prizePool, totalEntries } = mockTournamentInfo;

  return (
    <PageLayout>
      {/* Hero Section */}
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
          Submit your bracket predictions, earn points for correct picks, and compete for a share of
          the prize pool. Built on Solana for transparent, trustless payouts.
        </p>
        <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Button asChild size="lg" className="min-w-[200px]">
            <Link href={ROUTES.predictions}>
              Make Your Predictions
              <ChevronRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="min-w-[200px]">
            <Link href={ROUTES.leaderboard}>View Leaderboard</Link>
          </Button>
        </div>
      </section>

      {/* Tournament Info Section */}
      <section className="py-12">
        <h2 className="mb-8 text-center text-2xl font-bold md:text-3xl">Tournament Overview</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Target className="h-4 w-4" />
                Status
              </CardDescription>
            </CardHeader>
            <CardContent>{getStatusBadge(status)}</CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Coins className="h-4 w-4" />
                Entry Fee
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{ENTRY_FEE_SOL} SOL</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Trophy className="h-4 w-4" />
                Prize Pool
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{prizePool.toLocaleString()} SOL</p>
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
              <p className="text-2xl font-bold">{totalEntries.toLocaleString()}</p>
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
              <p className="text-2xl font-bold">{formatTimeRemaining(lockTime)}</p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-12">
        <h2 className="mb-8 text-center text-2xl font-bold md:text-3xl">How It Works</h2>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card className="relative overflow-hidden">
            <div className="bg-primary/10 text-primary absolute top-4 left-4 flex h-8 w-8 items-center justify-center rounded-full font-bold">
              1
            </div>
            <CardHeader className="pt-14">
              <Wallet className="text-primary mb-2 h-8 w-8" />
              <CardTitle>Connect Wallet</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Connect your Solana wallet (Phantom, Backpack, etc.) to get started. No KYC
                required.
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
                Predict group stage standings (1st-4th) for all {TOURNAMENT_CONFIG.totalGroups}{' '}
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
              <CardTitle>Claim Prizes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                After the tournament ends, top performers claim their share of the prize pool
                directly on-chain.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Scoring Breakdown Section */}
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
                Predict final standings for all {TOURNAMENT_CONFIG.totalGroups} groups
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Correct 1st place</span>
                  <span className="font-semibold">+5 points</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Correct 2nd place</span>
                  <span className="font-semibold">+3 points</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Correct 3rd place</span>
                  <span className="font-semibold">+2 points</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Correct 4th place</span>
                  <span className="font-semibold">+0 points</span>
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
              <CardDescription>Predict winners for all knockout matches</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Round of 32 (16 matches)</span>
                  <span className="font-semibold">+2 pts each</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Round of 16 (8 matches)</span>
                  <span className="font-semibold">+4 pts each</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Quarter-finals (4 matches)</span>
                  <span className="font-semibold">+8 pts each</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Semi-finals (2 matches)</span>
                  <span className="font-semibold">+15 pts each</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Third Place Match</span>
                  <span className="font-semibold">+10 pts</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Final</span>
                  <span className="font-semibold">+25 pts</span>
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
                Predict total tournament goals. Closest to actual total wins in case of tie.
              </p>
            </div>
            <div className="text-center sm:text-right">
              <p className="text-muted-foreground text-sm">Maximum Total Points</p>
              <p className="text-primary text-3xl font-bold">{SCORING.maxTotalPoints}</p>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* CTA Section */}
      <section className="py-12">
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="flex flex-col items-center gap-6 py-12 text-center">
            <Trophy className="text-primary h-16 w-16" />
            <div>
              <h2 className="mb-2 text-2xl font-bold md:text-3xl">Ready to Compete?</h2>
              <p className="text-muted-foreground mx-auto max-w-lg">
                Join thousands of players in the ultimate World Cup prediction challenge. Entry fee
                is just {ENTRY_FEE_SOL} SOL.
              </p>
            </div>
            <Button asChild size="lg" className="min-w-[250px]">
              <Link href={ROUTES.predictions}>
                Make Your Predictions
                <ChevronRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    </PageLayout>
  );
}
