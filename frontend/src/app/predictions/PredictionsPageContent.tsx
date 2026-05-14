'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FieldError } from '@/components/ui/field-error';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthContext } from '@/providers/AuthProvider';
import { useTournamentLock } from '@/hooks/useTournamentLock';
import {
  NEW_PREDICTION_SENTINEL,
  clearDraftForPrediction,
  useDraftPersistence,
} from '@/hooks/useDraftPersistence';
import { PREDICTION_NAME_MAX, PREDICTION_NAME_REGEX, ROUTES } from '@/lib/constants';
import { cn } from '@/lib/utils';
import type {
  AdvancerPrediction,
  Group,
  GroupPrediction,
  KnockoutMatch,
  KnockoutMatchPrediction,
  KnockoutStage,
  R32BracketAssignment,
  Team,
  TournamentInfo,
} from '@/types/tournament';
import { ADVANCER_COUNT } from '@/lib/constants';
import { applyGroupPositionChange } from '@/lib/groupSwap';
import { AdvancersForm } from '@/components/predictions/AdvancersForm';

type PositionKey = 'first' | 'second' | 'third' | 'fourth';

type Step =
  | 'groups'
  | 'best_thirds'
  | 'round_of_32'
  | 'round_of_16'
  | 'quarter_finals'
  | 'semi_finals'
  | 'final'
  | 'third_place'
  | 'tiebreaker';

type TopStep = 'groups' | 'best_thirds' | 'knockout' | 'tiebreaker';

const STEP_ORDER: Step[] = [
  'groups',
  'best_thirds',
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
  best_thirds: 'Best 3rds',
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

const TOP_STEPS: TopStep[] = ['groups', 'best_thirds', 'knockout', 'tiebreaker'];
const TOP_STEP_LABELS: Record<TopStep, string> = {
  groups: 'Group Stage',
  best_thirds: 'Best 3rds',
  knockout: 'Knockout',
  tiebreaker: 'Tiebreaker',
};

function isKnockoutStage(step: Step): step is KnockoutStage {
  return (KNOCKOUT_STAGE_LIST as Step[]).includes(step);
}

function topOf(step: Step): TopStep {
  if (step === 'groups') return 'groups';
  if (step === 'best_thirds') return 'best_thirds';
  if (step === 'tiebreaker') return 'tiebreaker';
  return 'knockout';
}

export interface InitialPrediction {
  id: string;
  name: string;
  totalGoals: number | null;
  submittedAt: string | null;
  isPaid: boolean;
  paidAt: string | null;
  groups: Array<{
    groupId: string;
    first: string | null;
    second: string | null;
    third: string | null;
    fourth: string | null;
  }>;
  knockout: Array<{ matchId: string; winner: string | null }>;
  advancers?: Array<{ rank: number; teamId: string }>;
}

interface DraftData {
  predictionName: string;
  groupPredictions: GroupPrediction[];
  knockoutPredictions: KnockoutMatchPrediction[];
  advancerPredictions: AdvancerPrediction[];
  totalGoals: number | null;
}

interface PredictionsPageContentProps {
  mode: 'create' | 'edit';
  predictionId?: string;
  initial?: InitialPrediction;
  /** Override the API base for create/edit. Defaults to /api/predictions. */
  apiBasePath?: string;
  /** Where to navigate after a successful save. Defaults to /predictions. */
  redirectAfterSave?: string;
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

function PaymentStatusBanner({
  isPaid,
  paidAt,
  lockTime,
  isLocked,
}: {
  isPaid: boolean;
  paidAt: string | null;
  lockTime: Date | null;
  isLocked: boolean;
}) {
  if (!lockTime) return null;

  const eligible = isPaid && paidAt && new Date(paidAt) <= lockTime;

  let tone: 'success' | 'warning' | 'danger';
  let title: string;
  let body: string;

  if (eligible) {
    tone = 'success';
    title = 'Payment received';
    body = 'This prediction is eligible for the leaderboard.';
  } else if (isPaid && !eligible) {
    tone = 'danger';
    title = 'Payment recorded after lock time';
    body =
      'Payment was recorded after the deadline, so this prediction is not on the leaderboard. Contact the admin if this is wrong.';
  } else if (isLocked) {
    tone = 'danger';
    title = 'Payment not recorded by lock time';
    body =
      'This prediction will not be counted on the leaderboard. Contact the admin if you paid in time.';
  } else {
    tone = 'warning';
    title = 'Payment not yet recorded';
    body = `This prediction will not count unless your payment is recorded by ${lockTime.toLocaleString()}. Pay the admin in cash, then they will mark it as paid.`;
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

export function PredictionsPageContent({
  mode,
  predictionId,
  initial,
  apiBasePath = '/api/predictions',
  redirectAfterSave,
}: PredictionsPageContentProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, profile } = useAuthContext();
  const { phase, isLocked } = useTournamentLock();
  const isSuperAdmin = profile?.isSuperAdmin === true;
  // Super admin user-side writes route through the admin RPC so they can edit
  // their own predictions in any phase (including phase1_locked / phase2_*).
  const effectiveApiBasePath =
    apiBasePath === '/api/predictions' &&
    isSuperAdmin &&
    phase !== 'phase1' &&
    user?.id
      ? `/api/admin/users/${user.id}/predictions`
      : apiBasePath;
  // Per-phase editability for the user-side forms. Super admin bypasses both.
  const phase1Editable = phase === 'phase1' || isSuperAdmin;
  const phase2Editable = phase === 'phase2_open' || isSuperAdmin;

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

  const bracketQuery = useQuery<{ assignments: R32BracketAssignment[] }>({
    queryKey: ['r32-bracket'],
    queryFn: () => fetchJSON('/api/r32-bracket'),
  });
  const bracketAssignments = bracketQuery.data?.assignments ?? [];

  const [predictionName, setPredictionName] = React.useState(initial?.name ?? '');
  const [predictionNameTouched, setPredictionNameTouched] = React.useState(false);
  const [serverNameError, setServerNameError] = React.useState<string | null>(null);
  const [groupPredictions, setGroupPredictions] = React.useState<GroupPrediction[]>([]);
  const [knockoutPredictions, setKnockoutPredictions] = React.useState<KnockoutMatchPrediction[]>(
    []
  );
  const [advancerPredictions, setAdvancerPredictions] = React.useState<AdvancerPrediction[]>(
    () =>
      (initial?.advancers ?? []).map((a) => ({
        rank: a.rank,
        teamId: a.teamId,
      }))
  );
  const [totalGoals, setTotalGoals] = React.useState<number | null>(initial?.totalGoals ?? null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isSavingProgress, setIsSavingProgress] = React.useState(false);
  const [hydrated, setHydrated] = React.useState(false);
  const [currentStep, setCurrentStep] = React.useState<Step>('groups');
  const tabsContentRef = React.useRef<HTMLDivElement | null>(null);
  const userInteractedRef = React.useRef(false);
  const initialStepSet = React.useRef(false);
  const nameRef = React.useRef<HTMLInputElement>(null);

  // Once we know the phase and have hydrated, jump straight to Round of 32
  // when phase 2 is open — group + advancer picks are frozen at that point
  // so the user's only remaining work is the knockout bracket. Runs once;
  // later navigation is up to the user.
  React.useEffect(() => {
    if (initialStepSet.current) return;
    if (!hydrated) return;
    initialStepSet.current = true;
    if (phase === 'phase2_open') {
      setCurrentStep('round_of_32');
    }
  }, [hydrated, phase]);

  const groups = groupsQuery.data;
  const teams = teamsQuery.data;
  const matches = matchesQuery.data;
  const tournament = tournamentQuery.data;
  const lockTime = tournament ? new Date(tournament.lockTime) : null;

  const draftPredictionId = predictionId ?? NEW_PREDICTION_SENTINEL;
  const { loadDraft, saveDraft, clearDraft, lastSavedAt } = useDraftPersistence<DraftData>(
    user?.id,
    tournament?.id,
    draftPredictionId
  );

  React.useEffect(() => {
    if (!groups || !matches || hydrated) return;
    const baseGroups = buildEmptyGroups(groups);
    const baseKnockout = buildEmptyKnockout(matches);

    const seedGroups = initial
      ? baseGroups.map((g) => {
          const match = initial.groups.find((s) => s.groupId === g.groupId);
          return match
            ? {
                groupId: g.groupId,
                positions: {
                  first: match.first,
                  second: match.second,
                  third: match.third,
                  fourth: match.fourth,
                },
              }
            : g;
        })
      : baseGroups;
    const seedKnockout = initial
      ? baseKnockout.map((m) => {
          const match = initial.knockout.find((s) => s.matchId === m.matchId);
          return match ? { matchId: m.matchId, winnerId: match.winner } : m;
        })
      : baseKnockout;

    const seedAdvancers: AdvancerPrediction[] = (initial?.advancers ?? []).map((a) => ({
      rank: a.rank,
      teamId: a.teamId,
    }));

    let groupSeed = seedGroups;
    let knockoutSeed = seedKnockout;
    let advancerSeed = seedAdvancers;
    let nameSeed = initial?.name ?? '';
    let totalGoalsSeed = initial?.totalGoals ?? null;
    let restoredFromDraft = false;

    if (isLocked) {
      clearDraft();
    } else {
      const draft = loadDraft();
      const isFreshCreate = mode === 'create' && !initial;
      const isFreshEdit =
        mode === 'edit' && initial && initial.submittedAt === null;
      if (draft && (isFreshCreate || isFreshEdit)) {
        groupSeed = baseGroups.map((g) => {
          const match = draft.data.groupPredictions.find((s) => s.groupId === g.groupId);
          return match ? { groupId: g.groupId, positions: { ...match.positions } } : g;
        });
        knockoutSeed = baseKnockout.map((m) => {
          const match = draft.data.knockoutPredictions.find((s) => s.matchId === m.matchId);
          return match ? { matchId: m.matchId, winnerId: match.winnerId } : m;
        });
        advancerSeed = draft.data.advancerPredictions ?? [];
        nameSeed = draft.data.predictionName ?? nameSeed;
        totalGoalsSeed = draft.data.totalGoals;
        restoredFromDraft = true;
      }
    }

    setGroupPredictions(groupSeed);
    setKnockoutPredictions(knockoutSeed);
    setAdvancerPredictions(advancerSeed);
    setTotalGoals(totalGoalsSeed);
    setPredictionName(nameSeed);
    setHydrated(true);

    if (restoredFromDraft) {
      toast.info('Restored your unsaved draft', {
        action: {
          label: 'Discard',
          onClick: () => {
            clearDraft();
            setGroupPredictions(seedGroups);
            setKnockoutPredictions(seedKnockout);
            setAdvancerPredictions(seedAdvancers);
            setTotalGoals(initial?.totalGoals ?? null);
            setPredictionName(initial?.name ?? '');
          },
        },
      });
    }
  }, [groups, matches, hydrated, isLocked, loadDraft, clearDraft, initial, mode]);

  const isLoading =
    tournamentQuery.isLoading ||
    groupsQuery.isLoading ||
    teamsQuery.isLoading ||
    matchesQuery.isLoading ||
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
  const completedAdvancers = advancerPredictions.filter((a) => !!a.teamId).length;
  const tiebreakerSlots = 1;
  const filledTiebreaker = totalGoals !== null ? 1 : 0;

  const totalSlots =
    totalGroupSlots + ADVANCER_COUNT + totalKnockoutMatches + tiebreakerSlots;
  const filledSlots =
    filledGroupSlots + completedAdvancers + completedKnockoutMatches + filledTiebreaker;
  const overallPercent = totalSlots > 0 ? Math.round((filledSlots / totalSlots) * 100) : 0;

  const isGroupsComplete = totalGroupsCount > 0 && completedGroups === totalGroupsCount;
  const isAdvancersComplete = completedAdvancers === ADVANCER_COUNT;
  const isBracketComplete =
    totalKnockoutMatches > 0 && completedKnockoutMatches === totalKnockoutMatches;
  const isTiebreakerComplete = totalGoals !== null;

  const usesAdminRoute = effectiveApiBasePath.startsWith('/api/admin/');
  // Submit ("mark this prediction submitted") requires the bracket to be
  // fully built — i.e. every section, across both phases, complete. Save
  // Progress doesn't use this gate; users save partial drafts in either
  // phase. In Phase 1 the knockout UI is read-only for regular users so
  // isBracketComplete is naturally false and Submit stays disabled until
  // Phase 2 opens.
  const isPredictionsComplete =
    isGroupsComplete && isAdvancersComplete && isBracketComplete && isTiebreakerComplete;

  const trimmedName = predictionName.trim();
  const nameError =
    !trimmedName
      ? 'Prediction name is required.'
      : trimmedName.length > PREDICTION_NAME_MAX
        ? `Max ${PREDICTION_NAME_MAX} characters.`
        : !PREDICTION_NAME_REGEX.test(trimmedName)
          ? 'Letters, numbers, spaces, and basic punctuation only.'
          : null;
  const showNameError = serverNameError ?? (predictionNameTouched ? nameError : null);
  const isReadyToSubmit = isPredictionsComplete && !nameError;

  const advancerCandidatePool = React.useMemo(() => {
    if (!teams) return [];
    const thirdIds = new Set(
      groupPredictions
        .map((g) => g.positions.third)
        .filter((id): id is string => id !== null)
    );
    return teams.filter((t) => thirdIds.has(t.id));
  }, [groupPredictions, teams]);

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
    best_thirds: isAdvancersComplete,
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

  // In Phase 1 regular users can't edit Phase 2 fields, so the Knockout
  // and Tiebreaker tabs are visually locked. Super admin can edit any
  // field in any phase, so they keep full access.
  const phase2TabsLocked = phase === 'phase1' && !isSuperAdmin;

  const topSteps: StepperStep[] = TOP_STEPS.map((value) => {
    let status: StepperStep['status'];
    if (isLocked) {
      status = 'locked';
    } else if (phase2TabsLocked && (value === 'knockout' || value === 'tiebreaker')) {
      status = 'locked';
    } else if (value === topValue) {
      status = 'current';
    } else if (value === 'groups') {
      status = isGroupsComplete ? 'done' : 'upcoming';
    } else if (value === 'best_thirds') {
      status = isAdvancersComplete ? 'done' : 'upcoming';
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
        predictionName:
          next.predictionName !== undefined ? next.predictionName : predictionName,
        groupPredictions: next.groupPredictions ?? groupPredictions,
        knockoutPredictions: next.knockoutPredictions ?? knockoutPredictions,
        advancerPredictions: next.advancerPredictions ?? advancerPredictions,
        totalGoals: next.totalGoals !== undefined ? next.totalGoals : totalGoals,
      });
    },
    [
      isLocked,
      hydrated,
      saveDraft,
      predictionName,
      groupPredictions,
      knockoutPredictions,
      advancerPredictions,
      totalGoals,
    ]
  );

  const handleNameChange = (value: string) => {
    setServerNameError(null);
    setPredictionName(value);
    persistDraft({ predictionName: value });
  };

  const handleGroupPredictionChange = (
    groupId: string,
    position: PositionKey,
    teamId: string | null
  ) => {
    setGroupPredictions((prev) => {
      // Conflict-swap semantics live in @/lib/groupSwap so admin code can
      // reuse the same behavior.
      const next = applyGroupPositionChange(prev, groupId, position, teamId);
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

  const handleAdvancerRankChange = (rank: number, teamId: string | null) => {
    setAdvancerPredictions((prev) => {
      const others = prev.filter((a) => a.rank !== rank);
      const next = teamId ? [...others, { rank, teamId }] : others;
      next.sort((a, b) => a.rank - b.rank);
      persistDraft({ advancerPredictions: next });
      return next;
    });
  };

  const goToStep = (value: Step) => {
    setCurrentStep(value);
    userInteractedRef.current = true;
  };

  const handleTopChange = (value: string) => {
    if (!TOP_STEPS.includes(value as TopStep)) return;
    if (value === 'groups') return goToStep('groups');
    if (value === 'best_thirds') return goToStep('best_thirds');
    if (value === 'tiebreaker') return goToStep('tiebreaker');
    const target = KNOCKOUT_STAGE_LIST.find((s) => !stageCompletion[s]) ?? 'round_of_32';
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

  const persist = async ({ markSubmitted }: { markSubmitted: boolean }) => {
    if (!tournament) return;
    setPredictionNameTouched(true);
    if (nameError) {
      nameRef.current?.focus();
      return;
    }
    if (markSubmitted && !isPredictionsComplete) {
      toast.error('Please complete all predictions before submitting');
      return;
    }

    if (markSubmitted) setIsSubmitting(true);
    else setIsSavingProgress(true);
    try {
      // Phase-aware payload. The RPC rejects mismatched fields (see the
      // matching gate around isPredictionsComplete above). Admin route
      // (admin_submit_predictions) has no phase guards, so send everything.
      const sendPhase1Fields = usesAdminRoute || phase === 'phase1';
      const sendPhase2Fields = usesAdminRoute || phase === 'phase2_open';
      const body = {
        tournamentId: tournament.id,
        predictionName: trimmedName,
        totalGoals: sendPhase2Fields ? totalGoals : null,
        submit: markSubmitted,
        groups: sendPhase1Fields
          ? groupPredictions.map((g) => ({
              groupId: g.groupId,
              first: g.positions.first,
              second: g.positions.second,
              third: g.positions.third,
              fourth: g.positions.fourth,
            }))
          : [],
        knockout: sendPhase2Fields
          ? knockoutPredictions.map((k) => ({
              matchId: k.matchId,
              winner: k.winnerId,
            }))
          : [],
        advancers: sendPhase1Fields
          ? advancerPredictions.map((a) => ({
              rank: a.rank,
              teamId: a.teamId,
            }))
          : [],
      };

      const url =
        mode === 'edit' && predictionId
          ? `${effectiveApiBasePath}/${encodeURIComponent(predictionId)}`
          : effectiveApiBasePath;
      const method = mode === 'edit' ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        const msg = String(errBody.error ?? 'Failed to save');
        if (msg.includes('name taken')) {
          setServerNameError('That prediction name is already in use.');
          nameRef.current?.focus();
          throw new Error('Pick a different prediction name.');
        }
        if (msg.includes('limit reached')) {
          throw new Error('You have reached the prediction limit.');
        }
        throw new Error(msg);
      }

      const data = (await res.json().catch(() => ({}))) as { predictionId?: string };
      const newId = data.predictionId ?? predictionId;

      clearDraft();
      if (mode === 'create' && user?.id && tournament.id) {
        clearDraftForPrediction(user.id, tournament.id, NEW_PREDICTION_SENTINEL);
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['predictions'] }),
        queryClient.invalidateQueries({ queryKey: ['prediction', newId] }),
      ]);
      toast.success(markSubmitted ? 'Prediction submitted' : 'Progress saved');

      if (markSubmitted) {
        router.push(redirectAfterSave ?? ROUTES.predictions);
      } else if (mode === 'create' && newId) {
        // Stay on the wizard but transition to edit-mode URL so subsequent
        // saves update the same draft instead of creating new ones.
        router.replace(`${ROUTES.predictions}/${encodeURIComponent(newId)}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setIsSubmitting(false);
      setIsSavingProgress(false);
    }
  };

  const handleSubmit = () => persist({ markSubmitted: true });
  const handleSaveProgress = () => persist({ markSubmitted: false });

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
  // In Phase 1, regular users have no knockout step to "Continue to" — the
  // bracket is read-only. Replace the bottom nav with a "Save Phase 1 Picks"
  // button on the last Phase 1 step (Best 3rds) so the user has a clear
  // end-of-Phase-1 commit action instead of being dumped into disabled
  // knockout screens. Super admin keeps Continue (god-mode editing).
  const isPhase1EndStep =
    phase === 'phase1' && !isSuperAdmin && currentStep === 'best_thirds';

  return (
    <PageLayout>
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-bold">
          {mode === 'edit' ? 'Edit Prediction' : 'New Prediction'}
        </h1>
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

      {mode === 'edit' && initial && (
        <PaymentStatusBanner
          isPaid={initial.isPaid}
          paidAt={initial.paidAt}
          lockTime={lockTime}
          isLocked={isLocked}
        />
      )}

      <Card className="mb-6">
        <CardContent className="space-y-2 py-4">
          <Label htmlFor="prediction-name">Prediction name</Label>
          <Input
            id="prediction-name"
            ref={nameRef}
            type="text"
            value={predictionName}
            onChange={(e) => handleNameChange(e.target.value)}
            onBlur={() => setPredictionNameTouched(true)}
            disabled={isLocked || isSubmitting}
            maxLength={PREDICTION_NAME_MAX}
            aria-invalid={showNameError ? true : undefined}
            aria-describedby={
              showNameError ? 'prediction-name-error' : 'prediction-name-help'
            }
            className={cn(showNameError && 'border-destructive focus-visible:ring-destructive')}
            placeholder="e.g. Main bracket"
          />
          {!showNameError && (
            <p id="prediction-name-help" className="text-muted-foreground text-xs">
              Up to {PREDICTION_NAME_MAX} characters. Shown next to your username on the leaderboard.
            </p>
          )}
          <FieldError id="prediction-name-error" message={showNameError || undefined} />
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
              disabled={!phase1Editable}
            />
          )}

          {currentStep === 'best_thirds' && (
            <AdvancersForm
              variant="predict"
              candidatePool={advancerCandidatePool}
              value={advancerPredictions}
              onRankChange={handleAdvancerRankChange}
              disabled={!phase1Editable}
            />
          )}

          {isKnockoutStage(currentStep) && (
            <KnockoutBracket
              matches={matches}
              teams={teams}
              groupPredictions={groupPredictions}
              knockoutPredictions={knockoutPredictions}
              bracketAssignments={bracketAssignments}
              onPredictionChange={handleKnockoutPredictionChange}
              disabled={!phase2Editable}
              stage={currentStep}
            />
          )}

          {currentStep === 'tiebreaker' && (
            <TiebreakerInput
              value={totalGoals}
              onChange={handleTotalGoalsChange}
              disabled={!phase2Editable}
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
          {isPhase1EndStep ? (
            <Button
              type="button"
              onClick={handleSaveProgress}
              disabled={
                !currentStepComplete ||
                isLocked ||
                isSavingProgress ||
                isSubmitting ||
                !!nameError
              }
              className="sm:w-auto"
            >
              {isSavingProgress ? 'Saving…' : 'Save Phase 1 Picks'}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : isLastStep ? (
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
        <CardContent className="flex flex-col gap-4 py-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold">Ready to submit?</p>
            <p className="text-muted-foreground text-sm">
              {isPredictionsComplete
                ? 'Submit puts this bracket on the leaderboard once an admin marks it paid.'
                : phase === 'phase1'
                  ? 'Save progress to keep working. You can submit once Phase 2 opens and the knockout bracket is complete.'
                  : 'Save progress to keep working — or complete every pick to submit.'}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              onClick={handleSaveProgress}
              disabled={isLocked || isSubmitting || isSavingProgress || !!nameError}
              className="min-w-[160px]"
            >
              {isSavingProgress ? 'Saving…' : 'Save progress'}
            </Button>
            <Button
              size="lg"
              onClick={handleSubmit}
              disabled={!isReadyToSubmit || isLocked || isSubmitting || isSavingProgress}
              className="min-w-[180px]"
            >
              {isSubmitting
                ? 'Submitting...'
                : isLocked
                  ? 'Predictions Locked'
                  : mode === 'edit'
                    ? 'Save Changes'
                    : 'Submit Prediction'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </PageLayout>
  );
}
