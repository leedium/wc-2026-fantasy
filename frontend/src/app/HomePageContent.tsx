'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  ChevronRight,
  Clock,
  CircleDollarSign,
  HeartHandshake,
  Target,
  Trophy,
  Users,
  UserPlus,
  Award,
} from 'lucide-react';

import { PageLayout } from '@/components/layout/PageLayout';
import { DonationsToCharity } from '@/components/marketing/DonationsToCharity';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { PRICING, ROUTES, TOURNAMENT_CONFIG } from '@/lib/constants';
import type { TournamentInfo } from '@/types/tournament';

interface TournamentResponse {
  id: string;
  slug: string;
  name: string;
  status: TournamentInfo['status'];
  lockTime: string;
  totalEntries: number;
  cashPaidPredictionCount: number;
  potTotalCAD: number;
  charityTotalCAD: number;
}

const POT_FORMATTER = new Intl.NumberFormat('en-CA', {
  style: 'currency',
  currency: 'CAD',
  maximumFractionDigits: 0,
});

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
      <section className="relative my-8 flex min-h-[480px] items-center justify-center overflow-hidden rounded-2xl md:min-h-[560px]">
        <Image
          src="/hero.jpg"
          alt="World Cup 2026 stadium filled with cheering fans under floodlights"
          fill
          priority
          sizes="(min-width: 1280px) 1248px, 100vw"
          className="object-cover"
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/20 to-black/30"
        />
        <div className="bg-background/80 dark:bg-background/70 relative z-10 mx-4 max-w-2xl rounded-2xl p-8 text-center shadow-xl backdrop-blur-md md:p-12">
          <Badge variant="outline" className="mb-4">
            FIFA World Cup 2026
          </Badge>
          <h1 className="mb-4 text-4xl font-bold tracking-tight md:text-6xl">
            World Cup 2026
            <br />
            <span className="text-primary">Prediction Game</span>
          </h1>
          <p className="text-muted-foreground mb-8 text-lg md:text-xl">
            Submit your bracket predictions, earn points for correct picks, and climb the
            leaderboard. ${PRICING.entryFeeCAD} {PRICING.currency} per prediction — $
            {PRICING.charityPortionCAD} from each entry goes to a charity announced before
            lock. Sign up free, pay per entry.
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
        </div>
      </section>

      <section className="py-12">
        <h2 className="mb-8 text-center text-2xl font-bold md:text-3xl">Tournament Overview</h2>
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
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
                <CircleDollarSign className="h-4 w-4" />
                Pot Total
              </CardDescription>
            </CardHeader>
            <CardContent>
              {query.isLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <p className="text-2xl font-bold">
                  {POT_FORMATTER.format(tournament?.potTotalCAD ?? 0)}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <HeartHandshake className="h-4 w-4" />
                Raised for Charity
              </CardDescription>
            </CardHeader>
            <CardContent>
              {query.isLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <p className="text-2xl font-bold">
                  {POT_FORMATTER.format(tournament?.charityTotalCAD ?? 0)}
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
                groups, rank the best 8 third-place teams, then complete the knockout bracket.
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

      <DonationsToCharity />

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
