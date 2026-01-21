'use client';

import Link from 'next/link';
import { Award, Clock, Trophy, ArrowRight } from 'lucide-react';

import { PageLayout } from '@/components/layout/PageLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ROUTES } from '@/lib/constants';

export default function ClaimsPage() {
  return (
    <PageLayout>
      <div className="flex flex-col items-center justify-center py-12">
        {/* Page Title */}
        <h1 className="mb-8 text-3xl font-bold">Claims</h1>

        {/* Coming Soon Card */}
        <Card className="w-full max-w-lg text-center">
          <CardHeader className="pb-4">
            <div className="bg-primary/10 mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full">
              <Award className="text-primary h-10 w-10" />
            </div>
            <CardTitle className="text-2xl">Coming Soon</CardTitle>
            <CardDescription className="text-base">
              Prize distribution is not yet available
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Explanation */}
            <div className="bg-muted/50 flex items-start gap-3 rounded-lg p-4 text-left">
              <Clock className="text-muted-foreground mt-0.5 h-5 w-5 flex-shrink-0" />
              <p className="text-muted-foreground text-sm">
                Prize claims will be available after the tournament ends. Once all matches are
                complete and final rankings are calculated, you&apos;ll be able to claim your share
                of the prize pool here.
              </p>
            </div>

            {/* What to do in the meantime */}
            <div className="space-y-3">
              <p className="text-sm font-medium">In the meantime:</p>
              <ul className="text-muted-foreground space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <Trophy className="text-primary h-4 w-4" />
                  Check your current ranking on the leaderboard
                </li>
                <li className="flex items-center gap-2">
                  <Award className="text-primary h-4 w-4" />
                  Follow the tournament to see how your predictions are doing
                </li>
              </ul>
            </div>

            {/* Link to Leaderboard */}
            <Button asChild className="w-full">
              <Link href={ROUTES.leaderboard}>
                View Leaderboard
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  );
}
