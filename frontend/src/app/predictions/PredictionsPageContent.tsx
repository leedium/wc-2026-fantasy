'use client';

import * as React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Clock, Save } from 'lucide-react';
import { toast } from 'sonner';

import { PageLayout } from '@/components/layout/PageLayout';
import { GroupStageForm } from '@/components/predictions/GroupStageForm';
import { KnockoutBracket } from '@/components/predictions/KnockoutBracket';
import { PredictionStepper, type StepperStep } from '@/components/predictions/PredictionStepper';
import { TiebreakerInput } from '@/components/predictions/TiebreakerInput';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthContext } from '@/providers/AuthProvider';
import { useDraftPersistence } from '@/hooks/useDraftPersistence';
import type {
  Group,
  GroupPrediction,
  KnockoutMatch,
  KnockoutMatchPrediction,
  Team,
  TournamentInfo,
} from '@/types/tournament';

type PositionKey = 'first' | 'second' | 'third' | 'fourth';
type StepValue = 'groups' | 'knockout' | 'tiebreaker';

const STEP_ORDER: StepValue[] = ['groups', 'knockout', 'tiebreaker'];
const STEP_LABELS: Record<StepValue, string> = {
  groups: 'Group Stage',
  knockout: 'Knockout',
  tiebreaker: 'Tiebreaker',
};

interface StoredPredictions {
  tournamentId: string;
  totalGoals: number | null;
  submittedAt: string | null;
  groups: Array<{
    groupId: string;
    first: string | null;
    second: string | null;
    third: string | null;
    fourth: string | null;
  }>;
  knockout: Array<{ matchId: string; winner: string | null }>;
}

interface DraftData {
  groupPredictions: GroupPrediction[];
  knockoutPredictions: KnockoutMatchPrediction[];
  totalGoals: number | null;
}

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error((await res.json())?.error ?? res.statusText);
  return res.json();
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

function formatClockTime(date: Date): string {
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function buildEmptyGroups(groups: Group[]): GroupPrediction[] {
  return groups.map((g) => ({
    groupId: g.id,
    positions: { first: null, second: null, third: null, fourth: null },
  }));
}

function buildEmptyKnockout(matches: KnockoutMatch[]): KnockoutMatchPrediction[] {
  return matches.map((m) => ({ matchId: m.id, winnerId: null }));
}

function isFreshServerState(stored: StoredPredictions): boolean {
  return (
    stored.submittedAt === null && stored.groups.length === 0 && stored.knockout.length === 0
  );
}

export function PredictionsPageContent() {
  const queryClient = useQueryClient();
  const { user } = useAuthContext();

  const tournamentQuery = useQuery<{
    id: string;
    slug: string;
    name: string;
    status: TournamentInfo['status'];
    lockTime: string;
    totalEntries: number;
  }>({
    queryKey: ['tournament'],
    queryFn: () => fetchJSON('/api/tournament'),
  });

  const groupsQuery = useQuery<Group[]>({
    queryKey: ['groups'],
    queryFn: () => fetchJSON('/api/groups'),
  });

  const teamsQuery = useQuery<Team[]>({
    queryKey: ['teams'],
    queryFn: () => fetchJSON('/api/teams'),
  });

  const matchesQuery = useQuery<KnockoutMatch[]>({
    queryKey: ['knockout-matches'],
    queryFn: () => fetchJSON('/api/knockout-matches'),
  });

  const predictionsQuery = useQuery<StoredPredictions>({
    queryKey: ['predictions'],
    queryFn: () => fetchJSON('/api/predictions'),
  });

  const [groupPredictions, setGroupPredictions] = React.useState<GroupPrediction[]>([]);
  const [knockoutPredictions, setKnockoutPredictions] = React.useState<KnockoutMatchPrediction[]>(
    []
  );
  const [totalGoals, setTotalGoals] = React.useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [hydrated, setHydrated] = React.useState(false);
  const [currentStep, setCurrentStep] = React.useState<StepValue>('groups');
  const tabsContentRef = React.useRef<HTMLDivElement | null>(null);
  const userInteractedRef = React.useRef(false);

  const groups = groupsQuery.data;
  const teams = teamsQuery.data;
  const matches = matchesQuery.data;
  const stored = predictionsQuery.data;

  const tournament = tournamentQuery.data;
  const lockTime = tournament ? new Date(tournament.lockTime) : null;
  const isLocked = lockTime ? new Date() >= lockTime : false;

  const { loadDraft, saveDraft, clearDraft, lastSavedAt } = useDraftPersistence<DraftData>(
    user?.id,
    tournament?.id
  );

  React.useEffect(() => {
    if (!groups || !matches || !stored || hydrated) return;
    const baseGroups = buildEmptyGroups(groups);
    const baseKnockout = buildEmptyKnockout(matches);

    const serverGroups = baseGroups.map((g) => {
      const match = stored.groups.find((s) => s.groupId === g.groupId);
      if (!match) return g;
      return {
        groupId: g.groupId,
        positions: {
          first: match.first,
          second: match.second,
          third: match.third,
          fourth: match.fourth,
        },
      };
    });
    const serverKnockout = baseKnockout.map((m) => {
      const match = stored.knockout.find((s) => s.matchId === m.matchId);
      return match ? { matchId: m.matchId, winnerId: match.winner } : m;
    });

    let groupSeed = serverGroups;
    let knockoutSeed = serverKnockout;
    let totalGoalsSeed = stored.totalGoals;
    let restoredFromDraft = false;

    if (isLocked) {
      clearDraft();
    } else if (isFreshServerState(stored)) {
      const draft = loadDraft();
      if (draft) {
        const draftGroups = baseGroups.map((g) => {
          const match = draft.data.groupPredictions.find((s) => s.groupId === g.groupId);
          return match ? { groupId: g.groupId, positions: { ...match.positions } } : g;
        });
        const draftKnockout = baseKnockout.map((m) => {
          const match = draft.data.knockoutPredictions.find((s) => s.matchId === m.matchId);
          return match ? { matchId: m.matchId, winnerId: match.winnerId } : m;
        });
        groupSeed = draftGroups;
        knockoutSeed = draftKnockout;
        totalGoalsSeed = draft.data.totalGoals;
        restoredFromDraft = true;
      }
    }

    setGroupPredictions(groupSeed);
    setKnockoutPredictions(knockoutSeed);
    setTotalGoals(totalGoalsSeed);
    setHydrated(true);

    if (restoredFromDraft) {
      toast.info('Restored your unsaved draft', {
        action: {
          label: 'Discard',
          onClick: () => {
            clearDraft();
            setGroupPredictions(serverGroups);
            setKnockoutPredictions(serverKnockout);
            setTotalGoals(stored.totalGoals);
          },
        },
      });
    }
  }, [groups, matches, stored, hydrated, isLocked, loadDraft, clearDraft]);

  const isLoading =
    tournamentQuery.isLoading ||
    groupsQuery.isLoading ||
    teamsQuery.isLoading ||
    matchesQuery.isLoading ||
    predictionsQuery.isLoading ||
    !hydrated;

  const totalGroupsCount = groups?.length ?? 0;
  const totalKnockoutMatches = matches?.length ?? 0;
  const filledGroupSlots = groupPredictions.reduce(
    (sum, p) => sum + Object.values(p.positions).filter((v) => v !== null).length,
    0
  );
  const totalGroupSlots = totalGroupsCount * 4;
  const completedGroups = groupPredictions.filter(
    (p) => Object.values(p.positions).filter((v) => v !== null).length === 4
  ).length;
  const completedKnockoutMatches = knockoutPredictions.filter((p) => p.winnerId !== null).length;
  const tiebreakerSlots = 1;
  const filledTiebreaker = totalGoals !== null ? 1 : 0;

  const totalSlots = totalGroupSlots + totalKnockoutMatches + tiebreakerSlots;
  const filledSlots = filledGroupSlots + completedKnockoutMatches + filledTiebreaker;
  const overallPercent = totalSlots > 0 ? Math.round((filledSlots / totalSlots) * 100) : 0;

  const isGroupsComplete = totalGroupsCount > 0 && completedGroups === totalGroupsCount;
  const isBracketComplete =
    totalKnockoutMatches > 0 && completedKnockoutMatches === totalKnockoutMatches;
  const isTiebreakerComplete = totalGoals !== null;
  const isPredictionsComplete = isGroupsComplete && isBracketComplete && isTiebreakerComplete;

  const stepStatus: Record<StepValue, boolean> = {
    groups: isGroupsComplete,
    knockout: isBracketComplete,
    tiebreaker: isTiebreakerComplete,
  };

  const steps: StepperStep[] = STEP_ORDER.map((value) => {
    const status: StepperStep['status'] = isLocked
      ? 'locked'
      : stepStatus[value]
        ? 'done'
        : value === currentStep
          ? 'current'
          : 'upcoming';
    return { value, label: STEP_LABELS[value], status };
  });

  const persistDraft = React.useCallback(
    (next: Partial<DraftData>) => {
      if (isLocked || !hydrated) return;
      saveDraft({
        groupPredictions: next.groupPredictions ?? groupPredictions,
        knockoutPredictions: next.knockoutPredictions ?? knockoutPredictions,
        totalGoals: next.totalGoals !== undefined ? next.totalGoals : totalGoals,
      });
    },
    [isLocked, hydrated, saveDraft, groupPredictions, knockoutPredictions, totalGoals]
  );

  const handleGroupPredictionChange = (
    groupId: string,
    position: PositionKey,
    teamId: string | null
  ) => {
    setGroupPredictions((prev) => {
      const next = prev.map((group) =>
        group.groupId === groupId
          ? { ...group, positions: { ...group.positions, [position]: teamId } }
          : group
      );
      persistDraft({ groupPredictions: next });
      return next;
    });
  };

  const handleKnockoutPredictionChange = (matchId: string, winnerId: string | null) => {
    setKnockoutPredictions((prev) => {
      const next = prev.map((prediction) =>
        prediction.matchId === matchId ? { ...prediction, winnerId } : prediction
      );
      persistDraft({ knockoutPredictions: next });
      return next;
    });
  };

  const handleTotalGoalsChange = (value: number | null) => {
    setTotalGoals(value);
    persistDraft({ totalGoals: value });
  };

  const handleStepChange = (value: string) => {
    if (!STEP_ORDER.includes(value as StepValue)) return;
    setCurrentStep(value as StepValue);
    userInteractedRef.current = true;
  };

  React.useEffect(() => {
    if (!userInteractedRef.current) return;
    if (typeof window === 'undefined') return;
    tabsContentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [currentStep]);

  const goToNextStep = () => {
    const idx = STEP_ORDER.indexOf(currentStep);
    if (idx >= 0 && idx < STEP_ORDER.length - 1) {
      setCurrentStep(STEP_ORDER[idx + 1]);
      userInteractedRef.current = true;
    }
  };

  const goToPreviousStep = () => {
    const idx = STEP_ORDER.indexOf(currentStep);
    if (idx > 0) {
      setCurrentStep(STEP_ORDER[idx - 1]);
      userInteractedRef.current = true;
    }
  };

  const focusSubmit = () => {
    if (typeof window === 'undefined') return;
    document.getElementById('submit-predictions-card')?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });
  };

  const handleSubmit = async () => {
    if (!tournament) return;
    if (!isPredictionsComplete) {
      toast.error('Please complete all predictions before submitting');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/predictions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tournamentId: tournament.id,
          totalGoals,
          groups: groupPredictions.map((g) => ({
            groupId: g.groupId,
            first: g.positions.first,
            second: g.positions.second,
            third: g.positions.third,
            fourth: g.positions.fourth,
          })),
          knockout: knockoutPredictions.map((k) => ({
            matchId: k.matchId,
            winner: k.winnerId,
          })),
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Failed to submit predictions');
      }

      clearDraft();
      await queryClient.invalidateQueries({ queryKey: ['predictions'] });
      toast.success('Predictions saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to submit predictions');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading || !tournament || !groups || !teams || !matches) {
    return (
      <PageLayout>
        <div className="space-y-4 py-8">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </PageLayout>
    );
  }

  const stepIndex = STEP_ORDER.indexOf(currentStep);
  const isFirstStep = stepIndex === 0;
  const isLastStep = stepIndex === STEP_ORDER.length - 1;
  const currentStepComplete = stepStatus[currentStep];
  const nextStepLabel = !isLastStep ? STEP_LABELS[STEP_ORDER[stepIndex + 1]] : null;
  const previousStepLabel = !isFirstStep ? STEP_LABELS[STEP_ORDER[stepIndex - 1]] : null;

  return (
    <PageLayout>
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-bold">Make Your Predictions</h1>
        <p className="text-muted-foreground">
          Submit your bracket predictions for the World Cup 2026. Complete all sections below.
        </p>
      </div>

      <Card className="mb-6">
        <CardContent className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Clock className="text-primary h-5 w-5" />
              <div>
                <p className="text-muted-foreground text-sm">Lock Time</p>
                <p className="font-semibold">
                  {lockTime ? formatTimeRemaining(lockTime) : '—'}
                </p>
              </div>
            </div>
            <Badge variant={isLocked ? 'outline' : 'default'}>
              {isLocked ? 'Locked' : 'Accepting Predictions'}
            </Badge>
            {!isLocked && lastSavedAt && (
              <span className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
                <Save className="h-3.5 w-3.5" aria-hidden />
                Draft saved · {formatClockTime(lastSavedAt)}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="mb-8">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Overall progress</span>
          <span className="font-medium">
            {filledSlots} / {totalSlots} picks · {overallPercent}%
          </span>
        </div>
        <Progress value={overallPercent} aria-label="Overall predictions progress" />
      </div>

      <Tabs value={currentStep} onValueChange={handleStepChange} className="mb-8">
        <PredictionStepper steps={steps} />

        <div ref={tabsContentRef}>
          <TabsContent value="groups">
            <GroupStageForm
              groups={groups}
              predictions={groupPredictions}
              onPredictionChange={handleGroupPredictionChange}
              disabled={isLocked}
            />
          </TabsContent>

          <TabsContent value="knockout">
            <KnockoutBracket
              matches={matches}
              teams={teams}
              groupPredictions={groupPredictions}
              knockoutPredictions={knockoutPredictions}
              onPredictionChange={handleKnockoutPredictionChange}
              disabled={isLocked}
            />
          </TabsContent>

          <TabsContent value="tiebreaker">
            <TiebreakerInput
              value={totalGoals}
              onChange={handleTotalGoalsChange}
              disabled={isLocked}
            />
          </TabsContent>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={goToPreviousStep}
            disabled={isFirstStep}
            className="sm:w-auto"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            {previousStepLabel ? `Back: ${previousStepLabel}` : 'Back'}
          </Button>
          {isLastStep ? (
            <Button
              type="button"
              onClick={focusSubmit}
              disabled={!currentStepComplete}
              className="sm:w-auto"
            >
              Review & submit
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={goToNextStep}
              disabled={!currentStepComplete || isLocked}
              className="sm:w-auto"
            >
              {nextStepLabel ? `Continue to ${nextStepLabel}` : 'Continue'}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
      </Tabs>

      <Card id="submit-predictions-card" className="border-primary/20 bg-primary/5">
        <CardContent className="flex flex-col items-center gap-4 py-6 sm:flex-row sm:justify-between">
          <div>
            <p className="font-semibold">Ready to submit?</p>
            <p className="text-muted-foreground text-sm">
              {!isPredictionsComplete
                ? 'Complete all predictions to submit'
                : 'Save your bracket to the leaderboard'}
            </p>
          </div>
          <Button
            size="lg"
            onClick={handleSubmit}
            disabled={!isPredictionsComplete || isLocked || isSubmitting}
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
