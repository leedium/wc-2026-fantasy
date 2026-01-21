'use client';

import * as React from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Clock, CheckCircle2, AlertCircle, Coins } from 'lucide-react';
import { toast } from 'sonner';

import { PageLayout } from '@/components/layout/PageLayout';
import { GroupStageForm } from '@/components/predictions/GroupStageForm';
import { KnockoutBracket } from '@/components/predictions/KnockoutBracket';
import { TiebreakerInput } from '@/components/predictions/TiebreakerInput';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { mockTournamentInfo, knockoutMatches, emptyPredictions } from '@/lib/mock-data';
import { ENTRY_FEE_SOL } from '@/lib/constants';
import type { GroupPrediction, KnockoutMatchPrediction } from '@/types/tournament';

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

// Position key type
type PositionKey = 'first' | 'second' | 'third' | 'fourth';

export function PredictionsPageContent() {
  const { connected } = useWallet();
  const { status, lockTime } = mockTournamentInfo;

  // Predictions state
  const [groupPredictions, setGroupPredictions] = React.useState<GroupPrediction[]>(
    emptyPredictions.groups
  );
  const [knockoutPredictions, setKnockoutPredictions] = React.useState<KnockoutMatchPrediction[]>(
    knockoutMatches.map((match) => ({ matchId: match.id, winnerId: null }))
  );
  const [totalGoals, setTotalGoals] = React.useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Check if tournament is locked
  const isLocked = new Date() >= lockTime;

  // Calculate completion stats
  const completedGroups = groupPredictions.filter((p) => {
    const filledPositions = Object.values(p.positions).filter((v) => v !== null).length;
    return filledPositions === 4;
  }).length;

  const completedKnockoutMatches = knockoutPredictions.filter((p) => p.winnerId !== null).length;
  const totalKnockoutMatches = knockoutMatches.length;

  const isGroupsComplete = completedGroups === 12;
  const isBracketComplete = completedKnockoutMatches === totalKnockoutMatches;
  const isTiebreakerComplete = totalGoals !== null;
  const isPredictionsComplete = isGroupsComplete && isBracketComplete && isTiebreakerComplete;

  // Handle group prediction change
  const handleGroupPredictionChange = (
    groupId: string,
    position: PositionKey,
    teamId: string | null
  ) => {
    setGroupPredictions((prev) =>
      prev.map((group) =>
        group.groupId === groupId
          ? { ...group, positions: { ...group.positions, [position]: teamId } }
          : group
      )
    );
  };

  // Handle knockout prediction change
  const handleKnockoutPredictionChange = (matchId: string, winnerId: string | null) => {
    setKnockoutPredictions((prev) =>
      prev.map((prediction) =>
        prediction.matchId === matchId ? { ...prediction, winnerId } : prediction
      )
    );
  };

  // Handle submit
  const handleSubmit = async () => {
    if (!connected) {
      toast.error('Please connect your wallet to submit predictions');
      return;
    }

    if (!isPredictionsComplete) {
      toast.error('Please complete all predictions before submitting');
      return;
    }

    setIsSubmitting(true);

    // Mock submit - in real app this would call the smart contract
    await new Promise((resolve) => setTimeout(resolve, 1500));

    toast.success('Predictions saved!', {
      description: `Your bracket predictions have been saved. Entry fee: ${ENTRY_FEE_SOL} SOL`,
    });

    setIsSubmitting(false);
  };

  return (
    <PageLayout>
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-bold">Make Your Predictions</h1>
        <p className="text-muted-foreground">
          Submit your bracket predictions for the World Cup 2026. Complete all sections below.
        </p>
      </div>

      {/* Tournament Status Card */}
      <Card className="mb-8">
        <CardContent className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Clock className="text-primary h-5 w-5" />
              <div>
                <p className="text-muted-foreground text-sm">Lock Time</p>
                <p className="font-semibold">{formatTimeRemaining(lockTime)}</p>
              </div>
            </div>
            <Badge variant={status === 'upcoming' ? 'secondary' : 'default'}>
              {status === 'upcoming' ? 'Accepting Predictions' : 'Locked'}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Coins className="text-muted-foreground h-5 w-5" />
            <div>
              <p className="text-muted-foreground text-sm">Entry Fee</p>
              <p className="font-semibold">{ENTRY_FEE_SOL} SOL</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Validation Summary Card */}
      <Card className="mb-8">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Prediction Progress</CardTitle>
          <CardDescription>Complete all sections to submit your predictions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex items-center gap-3">
              {isGroupsComplete ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : (
                <AlertCircle className="text-muted-foreground h-5 w-5" />
              )}
              <div>
                <p className="text-sm font-medium">Group Stage</p>
                <p className="text-muted-foreground text-xs">{completedGroups} / 12 complete</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {isBracketComplete ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : (
                <AlertCircle className="text-muted-foreground h-5 w-5" />
              )}
              <div>
                <p className="text-sm font-medium">Knockout Bracket</p>
                <p className="text-muted-foreground text-xs">
                  {completedKnockoutMatches} / {totalKnockoutMatches} matches
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {isTiebreakerComplete ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : (
                <AlertCircle className="text-muted-foreground h-5 w-5" />
              )}
              <div>
                <p className="text-sm font-medium">Tiebreaker</p>
                <p className="text-muted-foreground text-xs">
                  {isTiebreakerComplete ? `${totalGoals} goals` : 'Not set'}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Predictions Tabs */}
      <Tabs defaultValue="groups" className="mb-8">
        <TabsList className="mb-6 grid w-full grid-cols-3">
          <TabsTrigger value="groups" className="relative">
            Group Stage
            {isGroupsComplete && (
              <CheckCircle2 className="absolute -top-1 -right-1 h-4 w-4 text-green-500" />
            )}
          </TabsTrigger>
          <TabsTrigger value="knockout" className="relative">
            Knockout
            {isBracketComplete && (
              <CheckCircle2 className="absolute -top-1 -right-1 h-4 w-4 text-green-500" />
            )}
          </TabsTrigger>
          <TabsTrigger value="tiebreaker" className="relative">
            Tiebreaker
            {isTiebreakerComplete && (
              <CheckCircle2 className="absolute -top-1 -right-1 h-4 w-4 text-green-500" />
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="groups">
          <GroupStageForm
            predictions={groupPredictions}
            onPredictionChange={handleGroupPredictionChange}
            disabled={isLocked}
          />
        </TabsContent>

        <TabsContent value="knockout">
          <KnockoutBracket
            groupPredictions={groupPredictions}
            knockoutPredictions={knockoutPredictions}
            onPredictionChange={handleKnockoutPredictionChange}
            disabled={isLocked}
          />
        </TabsContent>

        <TabsContent value="tiebreaker">
          <TiebreakerInput value={totalGoals} onChange={setTotalGoals} disabled={isLocked} />
        </TabsContent>
      </Tabs>

      {/* Submit Section */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex flex-col items-center gap-4 py-6 sm:flex-row sm:justify-between">
          <div>
            <p className="font-semibold">Ready to submit?</p>
            <p className="text-muted-foreground text-sm">
              {!connected
                ? 'Connect your wallet to submit predictions'
                : !isPredictionsComplete
                  ? 'Complete all predictions to submit'
                  : `Entry fee: ${ENTRY_FEE_SOL} SOL will be charged on submit`}
            </p>
          </div>
          <Button
            size="lg"
            onClick={handleSubmit}
            disabled={!connected || !isPredictionsComplete || isLocked || isSubmitting}
            className="min-w-[180px]"
          >
            {isSubmitting
              ? 'Submitting...'
              : isLocked
                ? 'Predictions Locked'
                : 'Submit Predictions'}
          </Button>
        </CardContent>
      </Card>
    </PageLayout>
  );
}
