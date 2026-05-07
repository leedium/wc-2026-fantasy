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
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthContext } from '@/providers/AuthProvider';
import { useDraftPersistence } from '@/hooks/useDraftPersistence';
import type {
  Group,
  GroupPrediction,
  KnockoutMatch,
  KnockoutMatchPrediction,
  KnockoutStage,
  Team,
  TournamentInfo,
} from '@/types/tournament';

type PositionKey = 'first' | 'second' | 'third' | 'fourth';

type Step =
  | 'groups'
  | 'round_of_32'
  | 'round_of_16'
  | 'quarter_finals'
  | 'semi_finals'
  | 'final'
  | 'third_place'
  | 'tiebreaker';

type TopStep = 'groups' | 'knockout' | 'tiebreaker';

const STEP_ORDER: Step[] = [
  'groups',
  'round_of_32',
  'round_of_16',
  'quarter_finals',
  'semi_finals',
  'final',
  'third_place',
  'tiebreaker',
];

const STEP_LABELS: Record<Step, string> = {
  groups: 'Group Stage',
  round_of_32: 'Round of 32',
  round_of_16: 'Round of 16',
  quarter_finals: 'Quarter-finals',
  semi_finals: 'Semi-finals',
  final: 'Final',
  third_place: 'Third Place',
  tiebreaker: 'Tiebreaker',
};

const KNOCKOUT_STAGE_LIST: KnockoutStage[] = [
  'round_of_32',
  'round_of_16',
  'quarter_finals',
  'semi_finals',
  'final',
  'third_place',
];

const SUB_STEP_LABELS: Record<KnockoutStage, string> = {
  round_of_32: 'R32',
  round_of_16: 'R16',
  quarter_finals: 'QF',
  semi_finals: 'SF',
  final: 'Final',
  third_place: '3rd',
};

const TOP_STEPS: TopStep[] = ['groups', 'knockout', 'tiebreaker'];
const TOP_STEP_LABELS: Record<TopStep, string> = {
  groups: 'Group Stage',
  knockout: 'Knockout',
  tiebreaker: 'Tiebreaker',
};

function isKnockoutStage(step: Step): step is KnockoutStage {
  return (KNOCKOUT_STAGE_LIST as Step[]).includes(step);
}

function topOf(step: Step): TopStep {
  if (step === 'groups') return 'groups';
  if (step === 'tiebreaker') return 'tiebreaker';
  return 'knockout';
}

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

function PaymentStatusBanner({
  payment,
  lockTime,
  isLocked,
}: {
  payment: { paid: boolean; paidAt: string | null } | null;
  lockTime: Date | null;
  isLocked: boolean;
}) {
  if (!payment || !lockTime) return null;

  const eligible =
    payment.paid && payment.paidAt && new Date(payment.paidAt) <= lockTime;

  let tone: 'success' | 'warning' | 'danger';
  let title: string;
  let body: string;

  if (eligible) {
    tone = 'success';
    title = 'Payment received';
    body = 'Your entry is eligible for the leaderboard.';
  } else if (payment.paid && !eligible) {
    tone = 'danger';
    title = 'Payment recorded after lock time';
    body =
      'Your payment was recorded after the deadline, so your entry is not on the leaderboard. Contact the admin if this is wrong.';
  } else if (isLocked) {
    tone = 'danger';
    title = 'Payment not recorded by lock time';
    body =
      'Your entry will not be counted on the leaderboard. Contact the admin if you paid in time.';
  } else {
    tone = 'warning';
    title = 'Payment not yet recorded';
    body = `Your entry will not count unless your payment is recorded by ${lockTime.toLocaleString()}. Pay the admin in cash, then they will mark you as paid.`;
  }

  const toneClasses: Record<typeof tone, string> = {
    success: 'border-green-500/40 bg-green-500/10 text-green-900 dark:text-green-200',
    warning: 'border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200',
    danger: 'border-red-500/40 bg-red-500/10 text-red-900 dark:text-red-200',
  };

  return (
    <Card className={`mb-6 ${toneClasses[tone]}`}>
      <CardContent className="py-4">
        <p className="font-semibold">{title}</p>
        <p className="text-sm">{body}</p>
      </CardContent>
    </Card>
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

  const tournamentId = tournamentQuery.data?.id;
  const paymentQuery = useQuery<{ paid: boolean; paidAt: string | null }>({
    queryKey: ['payment', tournamentId],
    queryFn: () =>
      fetchJSON(`/api/payment?tournamentId=${encodeURIComponent(tournamentId!)}`),
    enabled: !!tournamentId,
  });

  const [groupPredictions, setGroupPredictions] = React.useState<GroupPrediction[]>([]);
  const [knockoutPredictions, setKnockoutPredictions] = React.useState<KnockoutMatchPrediction[]>(
    []
  );
  const [totalGoals, setTotalGoals] = React.useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [hydrated, setHydrated] = React.useState(false);
  const [currentStep, setCurrentStep] = React.useState<Step>('groups');
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

  const matchesByStage = React.useMemo(() => {
    const grouped: Record<KnockoutStage, KnockoutMatch[]> = {
      round_of_32: [],
      round_of_16: [],
      quarter_finals: [],
      semi_finals: [],
      third_place: [],
      final: [],
    };
    (matches ?? []).forEach((m) => {
      grouped[m.stage].push(m);
    });
    return grouped;
  }, [matches]);

  const stageCompletion: Record<KnockoutStage, boolean> = React.useMemo(() => {
    const out = {} as Record<KnockoutStage, boolean>;
    for (const s of KNOCKOUT_STAGE_LIST) {
      const stageMatches = matchesByStage[s];
      if (stageMatches.length === 0) {
        out[s] = false;
        continue;
      }
      out[s] = stageMatches.every((m) =>
        knockoutPredictions.some((p) => p.matchId === m.id && p.winnerId !== null)
      );
    }
    return out;
  }, [matchesByStage, knockoutPredictions]);

  const stepStatus: Record<Step, boolean> = {
    groups: isGroupsComplete,
    round_of_32: stageCompletion.round_of_32,
    round_of_16: stageCompletion.round_of_16,
    quarter_finals: stageCompletion.quarter_finals,
    semi_finals: stageCompletion.semi_finals,
    final: stageCompletion.final,
    third_place: stageCompletion.third_place,
    tiebreaker: isTiebreakerComplete,
  };

  const stepperStatus = (value: Step): StepperStep['status'] => {
    if (isLocked) return 'locked';
    if (stepStatus[value]) return 'done';
    if (value === currentStep) return 'current';
    return 'upcoming';
  };

  const topValue: TopStep = topOf(currentStep);

  const topSteps: StepperStep[] = TOP_STEPS.map((value) => {
    let status: StepperStep['status'];
    if (isLocked) {
      status = 'locked';
    } else if (value === topValue) {
      status = 'current';
    } else if (value === 'groups') {
      status = isGroupsComplete ? 'done' : 'upcoming';
    } else if (value === 'knockout') {
      status = isBracketComplete ? 'done' : 'upcoming';
    } else {
      status = isTiebreakerComplete ? 'done' : 'upcoming';
    }
    return { value, label: TOP_STEP_LABELS[value], status };
  });

  const subSteps: StepperStep[] = KNOCKOUT_STAGE_LIST.map((value) => ({
    value,
    label: SUB_STEP_LABELS[value],
    status: stepperStatus(value),
  }));

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

  const goToStep = (value: Step) => {
    setCurrentStep(value);
    userInteractedRef.current = true;
  };

  const handleTopChange = (value: string) => {
    if (!TOP_STEPS.includes(value as TopStep)) return;
    if (value === 'groups') return goToStep('groups');
    if (value === 'tiebreaker') return goToStep('tiebreaker');
    // Knockout: jump to the first incomplete knockout stage, or R32 if all empty.
    const target =
      KNOCKOUT_STAGE_LIST.find((s) => !stageCompletion[s]) ?? 'round_of_32';
    goToStep(target);
  };

  const handleSubChange = (value: string) => {
    if (!KNOCKOUT_STAGE_LIST.includes(value as KnockoutStage)) return;
    goToStep(value as Step);
  };

  React.useEffect(() => {
    if (!userInteractedRef.current) return;
    if (typeof window === 'undefined') return;
    tabsContentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [currentStep]);

  const goToNextStep = () => {
    const idx = STEP_ORDER.indexOf(currentStep);
    if (idx >= 0 && idx < STEP_ORDER.length - 1) {
      goToStep(STEP_ORDER[idx + 1]);
    }
  };

  const goToPreviousStep = () => {
    const idx = STEP_ORDER.indexOf(currentStep);
    if (idx > 0) {
      goToStep(STEP_ORDER[idx - 1]);
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

      <PaymentStatusBanner
        payment={paymentQuery.data ?? null}
        lockTime={lockTime}
        isLocked={isLocked}
      />


      <div className="mb-8">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Overall progress</span>
          <span className="font-medium">
            {filledSlots} / {totalSlots} picks · {overallPercent}%
          </span>
        </div>
        <Progress value={overallPercent} aria-label="Overall predictions progress" />
      </div>

      <div className="mb-8">
        <PredictionStepper
          topSteps={topSteps}
          topValue={topValue}
          onTopChange={handleTopChange}
          subSteps={topValue === 'knockout' ? subSteps : undefined}
          subValue={topValue === 'knockout' && isKnockoutStage(currentStep) ? currentStep : undefined}
          onSubChange={topValue === 'knockout' ? handleSubChange : undefined}
        />

        <div ref={tabsContentRef}>
          {currentStep === 'groups' && (
            <GroupStageForm
              groups={groups}
              predictions={groupPredictions}
              onPredictionChange={handleGroupPredictionChange}
              disabled={isLocked}
            />
          )}

          {isKnockoutStage(currentStep) && (
            <KnockoutBracket
              matches={matches}
              teams={teams}
              groupPredictions={groupPredictions}
              knockoutPredictions={knockoutPredictions}
              onPredictionChange={handleKnockoutPredictionChange}
              disabled={isLocked}
              stage={currentStep}
            />
          )}

          {currentStep === 'tiebreaker' && (
            <TiebreakerInput
              value={totalGoals}
              onChange={handleTotalGoalsChange}
              disabled={isLocked}
            />
          )}
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
      </div>

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
