'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Clock, Eye, Save } from 'lucide-react';
import { toast } from 'sonner';

import { PageLayout } from '@/components/layout/PageLayout';
import { BracketPreviewDialog } from '@/components/predictions/BracketPreviewDialog';
import { ChampionPickForm } from '@/components/predictions/ChampionPickForm';
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
  GroupStanding,
  KnockoutMatch,
  KnockoutMatchPrediction,
  KnockoutStage,
  R32BracketAssignment,
  Team,
  TournamentInfo,
} from '@/types/tournament';
import { ADVANCER_COUNT } from '@/lib/constants';
import { autofillGroupPredictionsByFifaRanking } from '@/lib/fifaRankings';
import { applyGroupPositionChange } from '@/lib/groupSwap';
import { cascadeKnockoutPick } from '@/lib/knockoutCascade';
import { AdvancersForm } from '@/components/predictions/AdvancersForm';
import { fetchJSON } from '@/lib/api/fetchJSON';

type PositionKey = 'first' | 'second' | 'third' | 'fourth';

type Step =
  | 'groups'
  | 'best_thirds'
  | 'champion_pick'
  | 'round_of_32'
  | 'round_of_16'
  | 'quarter_finals'
  | 'semi_finals'
  | 'final'
  | 'third_place'
  | 'tiebreaker';

type TopStep = 'groups' | 'best_thirds' | 'champion_pick' | 'knockout' | 'tiebreaker';

// 'third_place' (M103) sits between the semi-finals and the Final: the
// SF losers are known by then, and users pick the third-place winner
// (scored +5) just before the championship match.
const STEP_ORDER: Step[] = [
  'groups',
  'best_thirds',
  'champion_pick',
  'round_of_32',
  'round_of_16',
  'quarter_finals',
  'semi_finals',
  'third_place',
  'final',
  'tiebreaker',
];

const STEP_LABELS: Record<Step, string> = {
  groups: 'Group Stage',
  best_thirds: 'Best 3rds',
  champion_pick: 'Gut Feeling Champion',
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
  'third_place',
  'final',
];

const SUB_STEP_LABELS: Record<KnockoutStage, string> = {
  round_of_32: 'R32',
  round_of_16: 'R16',
  quarter_finals: 'QF',
  semi_finals: 'SF',
  final: 'Final',
  third_place: '3rd',
};

const TOP_STEPS: TopStep[] = ['groups', 'best_thirds', 'champion_pick', 'knockout', 'tiebreaker'];
const TOP_STEP_LABELS: Record<TopStep, string> = {
  groups: 'Group Stage',
  best_thirds: 'Best 3rds',
  champion_pick: 'Gut Feeling',
  knockout: 'Knockout',
  tiebreaker: 'Tiebreaker',
};

// A representative concrete Step for each top tab, used to test whether the
// tab's phase is locked (the Knockout tab fans out into per-stage sub-steps).
const TOP_STEP_REP: Record<TopStep, Step> = {
  groups: 'groups',
  best_thirds: 'best_thirds',
  champion_pick: 'champion_pick',
  knockout: 'round_of_32',
  tiebreaker: 'tiebreaker',
};

function isKnockoutStage(step: Step): step is KnockoutStage {
  return (KNOCKOUT_STAGE_LIST as Step[]).includes(step);
}

function topOf(step: Step): TopStep {
  if (step === 'champion_pick') return 'champion_pick';
  if (step === 'groups') return 'groups';
  if (step === 'best_thirds') return 'best_thirds';
  if (step === 'tiebreaker') return 'tiebreaker';
  return 'knockout';
}

export interface InitialPrediction {
  id: string;
  name: string;
  totalGoals: number | null;
  championTeamId: string | null;
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
  championTeamId: string | null;
}

// Canonical, order-insensitive serialization of a prediction's picks, used to
// detect whether anything changed since the last save (so nav auto-save can
// skip the DB round-trip when nothing did). Sorting + trimming means a
// mismatch can only ever cause an unnecessary save, never a lost one.
function serializePicks(d: DraftData): string {
  return JSON.stringify({
    predictionName: d.predictionName.trim(),
    championTeamId: d.championTeamId,
    totalGoals: d.totalGoals,
    groups: [...d.groupPredictions]
      .sort((a, b) => a.groupId.localeCompare(b.groupId))
      .map((g) => [
        g.groupId,
        g.positions.first,
        g.positions.second,
        g.positions.third,
        g.positions.fourth,
      ]),
    advancers: [...d.advancerPredictions]
      .sort((a, b) => a.rank - b.rank)
      .map((a) => [a.rank, a.teamId]),
    knockout: [...d.knockoutPredictions]
      .sort((a, b) => a.matchId.localeCompare(b.matchId))
      .map((k) => [k.matchId, k.winnerId]),
  });
}

interface PredictionsPageContentProps {
  mode: 'create' | 'edit';
  predictionId?: string;
  initial?: InitialPrediction;
  /** Override the API base for create/edit. Defaults to /api/predictions. */
  apiBasePath?: string;
  /** Where to navigate after a successful save. Defaults to /predictions. */
  redirectAfterSave?: string;
  /** Optional breadcrumb rendered above the title (used by admin pages). */
  breadcrumb?: React.ReactNode;
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
  breadcrumb,
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
  // Super admin can keep navigating between steps after the tournament
  // locks (they're the only role whose forms remain editable through
  // locks — phase1Editable/phase2Editable above). Without this bypass
  // the Continue button + step tabs get force-disabled by isLocked,
  // stranding super admin on the Groups step in the admin editor.
  const bypassLockNav = isSuperAdmin;

  // A step is "locked" when its phase's edit window is closed for this user.
  // Phase 1 steps (Group Stage / Best 3rds / Gut Feeling) freeze once Phase 2
  // opens; Phase 2 steps (Knockout / Tiebreaker) stay locked until Phase 2
  // opens. Super admin edits any field in any phase, so nothing locks for
  // them. In the fully-locked read-only phases (phase1_locked / phase2_locked)
  // nothing is step-locked either — users keep browsing every section via the
  // stepper and Back / Continue (the forms themselves render read-only).
  const isStepLocked = React.useCallback(
    (step: Step): boolean => {
      if (isSuperAdmin) return false;
      const top = topOf(step);
      const isPhase1Step =
        top === 'groups' || top === 'best_thirds' || top === 'champion_pick';
      const isPhase2Step = top === 'knockout' || top === 'tiebreaker';
      if (phase === 'phase2_open' && isPhase1Step) return true;
      if (phase === 'phase1' && isPhase2Step) return true;
      return false;
    },
    [isSuperAdmin, phase]
  );

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

  const groupStandingsQuery = useQuery<{ standings: GroupStanding[] }>({
    queryKey: ['group-standings'],
    queryFn: () => fetchJSON('/api/group-standings'),
  });
  const groupStandings = groupStandingsQuery.data?.standings ?? [];

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
  const [championTeamId, setChampionTeamId] = React.useState<string | null>(
    initial?.championTeamId ?? null
  );
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isSavingProgress, setIsSavingProgress] = React.useState(false);
  const [hydrated, setHydrated] = React.useState(false);
  const [currentStep, setCurrentStep] = React.useState<Step>('groups');
  const userInteractedRef = React.useRef(false);
  const initialStepSet = React.useRef(false);
  const nameRef = React.useRef<HTMLInputElement>(null);
  // Serialized picks as last known on the server. Nav auto-save compares
  // against this and skips the DB round-trip when nothing changed.
  const lastSavedSnapshotRef = React.useRef<string | null>(null);
  // Wall-clock time of the last successful server save (any persist). Shown in
  // the footer for an already-submitted prediction so silent auto-commits are
  // visible — distinct from the localStorage draft time (`lastSavedAt`).
  const [lastServerSaveAt, setLastServerSaveAt] = React.useState<Date | null>(null);
  const [autoCommitFailed, setAutoCommitFailed] = React.useState(false);
  const [previewOpen, setPreviewOpen] = React.useState(false);

  // Once we know the phase and have hydrated, jump straight to Round of 32
  // when phase 2 is open — group + advancer + champion picks are frozen at
  // that point so the user's only remaining work is the knockout bracket.
  // Runs once; later navigation is up to the user.
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
    let championSeed = initial?.championTeamId ?? null;
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
        championSeed = draft.data.championTeamId ?? championSeed;
        restoredFromDraft = true;
      }
    }

    setGroupPredictions(groupSeed);
    setKnockoutPredictions(knockoutSeed);
    setAdvancerPredictions(advancerSeed);
    setTotalGoals(totalGoalsSeed);
    setChampionTeamId(championSeed);
    setPredictionName(nameSeed);
    setHydrated(true);

    // Baseline = the SERVER state (seeds before any draft override), so
    // draft-restored unsaved changes count as dirty and save on first nav.
    lastSavedSnapshotRef.current = serializePicks({
      predictionName: initial?.name ?? '',
      championTeamId: initial?.championTeamId ?? null,
      totalGoals: initial?.totalGoals ?? null,
      groupPredictions: seedGroups,
      advancerPredictions: seedAdvancers,
      knockoutPredictions: seedKnockout,
    });

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
            setChampionTeamId(initial?.championTeamId ?? null);
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
  // Every knockout match is pickable — including M103 (third-place
  // playoff), which is a required, scored (+5) round again.
  const totalKnockoutMatches = matches?.length ?? 0;
  const filledGroupSlots = groupPredictions.reduce(
    (sum, p) => sum + Object.values(p.positions).filter((v) => v !== null).length,
    0
  );
  const totalGroupSlots = totalGroupsCount * 4;
  const completedGroups = groupPredictions.filter(
    (p) => Object.values(p.positions).filter((v) => v !== null).length === 4
  ).length;
  const completedKnockoutMatches = knockoutPredictions.filter(
    (p) => p.winnerId !== null
  ).length;
  const completedAdvancers = advancerPredictions.filter((a) => !!a.teamId).length;
  const tiebreakerSlots = 1;
  const filledTiebreaker = totalGoals !== null ? 1 : 0;
  const championSlots = 1;
  const filledChampion = championTeamId !== null ? 1 : 0;

  const usesAdminRoute = effectiveApiBasePath.startsWith('/api/admin/');
  // The two phases are decoupled end-to-end (server RPC branches on
  // phase; payload composition strips fields from the other phase; UI
  // disables the other phase's forms). The submit / progress gates
  // follow suit: only check the fields this save can actually write.
  // Otherwise a legacy prediction with stale Phase 1 state (null
  // champion, missing advancers, partial groups) traps the user — they
  // can't edit Phase 1 in Phase 2 to satisfy the gate.
  const requiresPhase1Fields = usesAdminRoute || phase === 'phase1';
  const requiresPhase2Fields = usesAdminRoute || phase === 'phase2_open';

  const totalSlots =
    (requiresPhase1Fields ? championSlots + totalGroupSlots + ADVANCER_COUNT : 0) +
    (requiresPhase2Fields ? totalKnockoutMatches + tiebreakerSlots : 0);
  const filledSlots =
    (requiresPhase1Fields ? filledChampion + filledGroupSlots + completedAdvancers : 0) +
    (requiresPhase2Fields ? completedKnockoutMatches + filledTiebreaker : 0);
  const overallPercent = totalSlots > 0 ? Math.round((filledSlots / totalSlots) * 100) : 0;

  const isChampionPickComplete = championTeamId !== null;
  const isGroupsComplete = totalGroupsCount > 0 && completedGroups === totalGroupsCount;
  const isAdvancersComplete = completedAdvancers === ADVANCER_COUNT;
  const isBracketComplete =
    totalKnockoutMatches > 0 && completedKnockoutMatches === totalKnockoutMatches;
  const isTiebreakerComplete = totalGoals !== null;

  // Submit ("mark this prediction submitted") requires only the fields
  // the current phase is responsible for. Phase 1's commit is the
  // "Save Phase 1 Picks" button; Phase 2's commit is "Submit
  // Prediction" on the tiebreaker. Each commits its own slice.
  const isPredictionsComplete =
    (!requiresPhase1Fields ||
      (isChampionPickComplete && isGroupsComplete && isAdvancersComplete)) &&
    (!requiresPhase2Fields || (isBracketComplete && isTiebreakerComplete));

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
    champion_pick: isChampionPickComplete,
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
    if (stepStatus[value]) return 'done';
    if (value === currentStep) return 'current';
    return 'upcoming';
  };

  const topValue: TopStep = topOf(currentStep);

  // Tabs whose phase is closed for this user render a lock icon and become
  // non-interactive (see `isStepLocked`): Phase 2 tabs during Phase 1, and the
  // Phase 1 tabs once Phase 2 is open. Super admin keeps full access.
  const topSteps: StepperStep[] = TOP_STEPS.map((value) => {
    let status: StepperStep['status'];
    if (isStepLocked(TOP_STEP_REP[value])) {
      status = 'locked';
    } else if (value === topValue) {
      status = 'current';
    } else if (value === 'champion_pick') {
      status = isChampionPickComplete ? 'done' : 'upcoming';
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
        championTeamId:
          next.championTeamId !== undefined ? next.championTeamId : championTeamId,
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
      championTeamId,
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

  const handleAutofillGroupsByFifaRanking = () => {
    if (!groups) return;
    const next = autofillGroupPredictionsByFifaRanking(groups);
    setGroupPredictions(next);
    persistDraft({ groupPredictions: next });
  };

  const handleResetGroups = () => {
    if (!groups) return;
    const next = buildEmptyGroups(groups);
    setGroupPredictions(next);
    persistDraft({ groupPredictions: next });
  };

  const handleKnockoutPredictionChange = (matchId: string, winnerId: string | null) => {
    if (!matches) return;
    // Use the functional updater so rapid sequential changes (e.g. filling
    // several matches in one tick) accumulate against the latest state rather
    // than a stale closure. Side effects mirror the existing persistDraft
    // pattern below.
    setKnockoutPredictions((prev) => {
      const { predictions: next, changedMatchIds } = cascadeKnockoutPick(
        matchId,
        winnerId,
        matches,
        prev,
        groupPredictions,
        bracketAssignments,
        groupStandings
      );
      persistDraft({ knockoutPredictions: next });
      if (changedMatchIds.length > 0) {
        toast.info(
          `Carried your pick through ${changedMatchIds.length} later ${
            changedMatchIds.length === 1 ? 'match' : 'matches'
          }`
        );
      }
      return next;
    });
  };

  const handleTotalGoalsChange = (value: number | null) => {
    setTotalGoals(value);
    persistDraft({ totalGoals: value });
  };

  const handleChampionTeamIdChange = (value: string | null) => {
    setChampionTeamId(value);
    persistDraft({ championTeamId: value });
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
    navigateWithAutosave(() => {
      if (value === 'champion_pick') return goToStep('champion_pick');
      if (value === 'groups') return goToStep('groups');
      if (value === 'best_thirds') return goToStep('best_thirds');
      if (value === 'tiebreaker') return goToStep('tiebreaker');
      const target =
        KNOCKOUT_STAGE_LIST.find((s) => !stageCompletion[s]) ?? 'round_of_32';
      goToStep(target);
    });
  };

  const handleSubChange = (value: string) => {
    if (!KNOCKOUT_STAGE_LIST.includes(value as KnockoutStage)) return;
    navigateWithAutosave(() => goToStep(value as Step));
  };

  // After any step transition (top-tab, sub-tab, Continue button), scroll the
  // viewport back to the page top. Previously this used
  // `tabsContentRef.scrollIntoView({ block: 'start' })`, which (a) put the
  // content wrapper at the top with the stepper above the viewport — so users
  // landed on a new step with no indication of which step they were on — and
  // (b) was unreliable on iOS Safari, which sometimes ignores `block: 'start'`
  // when the target is partially in view. `window.scrollTo` is rock-solid
  // cross-browser and lands above the progress bar + stepper so the user can
  // immediately see what step they're on.
  React.useEffect(() => {
    if (!userInteractedRef.current) return;
    if (typeof window === 'undefined') return;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentStep]);

  // Walk STEP_ORDER from the current step in `dir`, skipping locked steps so
  // Back / Continue never strand the user on a frozen phase (e.g. Back from
  // Round of 32 in Phase 2 skips the locked Phase 1 steps and finds nothing
  // before it, disabling Back).
  const findAdjacentUnlockedStep = (dir: 1 | -1): Step | null => {
    let idx = STEP_ORDER.indexOf(currentStep) + dir;
    while (idx >= 0 && idx < STEP_ORDER.length) {
      if (!isStepLocked(STEP_ORDER[idx])) return STEP_ORDER[idx];
      idx += dir;
    }
    return null;
  };

  const goToNextStep = () => {
    const target = findAdjacentUnlockedStep(1);
    if (!target) return;
    navigateWithAutosave(() => goToStep(target));
  };

  const goToPreviousStep = () => {
    const target = findAdjacentUnlockedStep(-1);
    if (!target) return;
    navigateWithAutosave(() => goToStep(target));
  };

  const persist = async ({
    markSubmitted,
    redirectTo,
    silent,
    auto,
  }: {
    markSubmitted: boolean;
    /** Override navigation after a successful save-progress (not Submit). */
    redirectTo?: string;
    /** Suppress the "Progress saved" toast (e.g. nav-triggered autosaves). */
    silent?: boolean;
    /**
     * Background auto-commit (debounced edit of an already-submitted
     * prediction). Suppresses the error toast too — failures surface as a quiet
     * inline status and retry on the next edit instead of spamming toasts.
     */
    auto?: boolean;
  }): Promise<boolean> => {
    if (!tournament) return false;
    setPredictionNameTouched(true);
    if (nameError) {
      toast.error(nameError);
      nameRef.current?.focus();
      nameRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return false;
    }
    if (markSubmitted && !isPredictionsComplete) {
      toast.error('Please complete all predictions before submitting');
      return false;
    }
    // The submit_predictions RPC requires champion_team_id whenever Phase 1
    // writes are involved (create, or any Phase 1 edit). Guard before the
    // network round-trip so the user lands back on the Champion Pick step
    // instead of seeing a generic save-failed toast.
    const willSendPhase1 = usesAdminRoute || phase === 'phase1';
    if (willSendPhase1 && !championTeamId) {
      toast.error('Pick a champion before saving');
      goToStep('champion_pick');
      return false;
    }

    // Snapshot of the full picks being saved — becomes the new "last saved"
    // baseline on success so a subsequent unchanged nav skips the round-trip.
    const savedSnapshot = serializePicks({
      predictionName: trimmedName,
      championTeamId,
      totalGoals,
      groupPredictions,
      advancerPredictions,
      knockoutPredictions,
    });

    if (markSubmitted) setIsSubmitting(true);
    else setIsSavingProgress(true);
    try {
      // Phase-aware payload. The RPC rejects mismatched fields (see the
      // matching gate around isPredictionsComplete above). Admin route
      // (admin_submit_predictions) has no phase guards, so send everything.
      const sendPhase1Fields = usesAdminRoute || phase === 'phase1';
      const sendPhase2Fields = usesAdminRoute || phase === 'phase2_open';
      // championTeamId is a Phase 1 field: only forward it when the RPC
      // will accept Phase 1 writes. On a Phase 2 PATCH from a regular user
      // we omit the key entirely so the RPC preserves the existing value.
      const body: Record<string, unknown> = {
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
      if (sendPhase1Fields) {
        body.championTeamId = championTeamId;
      }

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
        throw new Error(msg);
      }

      const data = (await res.json().catch(() => ({}))) as { predictionId?: string };
      const newId = data.predictionId ?? predictionId;

      lastSavedSnapshotRef.current = savedSnapshot;
      setLastServerSaveAt(new Date());
      setAutoCommitFailed(false);
      clearDraft();
      if (mode === 'create' && user?.id && tournament.id) {
        clearDraftForPrediction(user.id, tournament.id, NEW_PREDICTION_SENTINEL);
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['predictions'] }),
        // Prefix invalidation: covers both the wizard's
        // ['prediction', newId] (loaded for edit mode) and
        // BracketPreviewDialog's ['prediction', apiBasePath, predictionId].
        queryClient.invalidateQueries({ queryKey: ['prediction'] }),
        // When the admin wizard saves, the user list (`['admin-users']`,
        // prediction counts), the per-user predictions view
        // (`['admin-user-predictions', userId]`), and the dashboard stats
        // (`['admin-stats']`, champion-pick distribution) all reflect
        // counts/values that just changed. Mark them stale so the next
        // mount refetches.
        ...(usesAdminRoute
          ? [
              queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
              queryClient.invalidateQueries({ queryKey: ['admin-user-predictions'] }),
              queryClient.invalidateQueries({ queryKey: ['admin-stats'] }),
            ]
          : []),
      ]);
      if (!silent) {
        toast.success(markSubmitted ? 'Prediction submitted' : 'Progress saved');
      }

      if (markSubmitted) {
        router.push(redirectAfterSave ?? ROUTES.predictions);
      } else if (redirectTo) {
        router.push(redirectTo);
      } else if (mode === 'create' && newId) {
        // Stay on the wizard but transition to edit-mode URL so subsequent
        // saves update the same draft instead of creating new ones.
        router.replace(`${ROUTES.predictions}/${encodeURIComponent(newId)}`);
      }
      return true;
    } catch (err) {
      if (auto) {
        // Quiet failure for background auto-commit; the next edit reschedules.
        setAutoCommitFailed(true);
      } else {
        toast.error(err instanceof Error ? err.message : 'Failed to save');
      }
      return false;
    } finally {
      setIsSubmitting(false);
      setIsSavingProgress(false);
    }
  };

  const handleSubmit = () => persist({ markSubmitted: true });
  const handleSavePhase1 = () =>
    persist({ markSubmitted: false, redirectTo: redirectAfterSave ?? ROUTES.predictions });
  const handleSaveProgress = () => persist({ markSubmitted: false });

  // Is a server auto-save currently allowed + warranted? Editable phases
  // (phase1 + phase2_open) and admin edits get auto-save so picks aren't
  // marooned in localStorage. In Phase 1 we still skip the save when
  // champion_team_id is unset — the RPC requires it, so we wait until the user
  // reaches the Champion Pick step (the draft preserves their other picks in
  // the meantime). Shared by nav auto-save and the submitted-prediction
  // auto-commit effect.
  const canAutosave = (): boolean => {
    if (isLocked) return false;
    if (isSavingProgress || isSubmitting) return false;
    const isEditablePhase = phase === 'phase1' || phase === 'phase2_open';
    if (!usesAdminRoute && !isEditablePhase) return false;
    if (mode === 'create' && nameError) return false;
    const willSendPhase1 = usesAdminRoute || phase === 'phase1';
    if (willSendPhase1 && !championTeamId) return false;
    // Nothing changed since the last save — skip the DB round-trip; the
    // caller (navigateWithAutosave) just navigates.
    const currentSnapshot = serializePicks({
      predictionName,
      championTeamId,
      totalGoals,
      groupPredictions,
      advancerPredictions,
      knockoutPredictions,
    });
    if (currentSnapshot === lastSavedSnapshotRef.current) return false;
    return true;
  };

  // Run the autosave + navigate-on-success flow. Stays sync (microtask-free)
  // when no save is needed, so tests using fake timers don't have to advance
  // microtasks for every Continue / Back click.
  const navigateWithAutosave = (navigate: () => void) => {
    if (!canAutosave()) {
      navigate();
      return;
    }
    void (async () => {
      const ok = await persist({ markSubmitted: false, silent: true });
      if (ok) navigate();
    })();
  };

  // Open the full read-only preview. The dialog fetches from the server, so
  // flush any pending edits first (when a save is warranted) — otherwise the
  // preview would show the last-saved snapshot, not what's on screen.
  const handleOpenPreview = async () => {
    if (canAutosave()) {
      await persist({ markSubmitted: false, silent: true });
    }
    setPreviewOpen(true);
  };

  // Auto-commit edits to an ALREADY-submitted prediction. A draft lives in
  // localStorage until the user navigates/submits, but a submitted prediction
  // is live on the leaderboard and shown in the preview dialog, so its edits
  // must reach the server promptly — otherwise the preview/leaderboard show
  // stale picks. We persist with submit:false: it applies the picks and
  // preserves submitted_at (and its leaderboard tie-break position) rather than
  // re-stamping the submission time. Create/draft predictions keep the existing
  // localStorage + nav-autosave behavior.
  const wasSubmitted = mode === 'edit' && !!initial?.submittedAt;
  const picksSnapshot = serializePicks({
    predictionName,
    championTeamId,
    totalGoals,
    groupPredictions,
    advancerPredictions,
    knockoutPredictions,
  });
  // Keep the commit action in a ref so the debounce timer runs the latest state
  // and re-checks the guard at fire time (no double-save if the user also navs).
  const autoCommitRef = React.useRef<() => void>(() => {});
  React.useEffect(() => {
    autoCommitRef.current = () => {
      if (canAutosave()) {
        void persist({ markSubmitted: false, silent: true, auto: true });
      }
    };
  });
  React.useEffect(() => {
    if (!wasSubmitted || !hydrated) return;
    if (picksSnapshot === lastSavedSnapshotRef.current) return; // nothing changed
    const timer = setTimeout(() => autoCommitRef.current(), 1500);
    return () => clearTimeout(timer);
  }, [picksSnapshot, wasSubmitted, hydrated]);

  if (isLoading || !tournament || !groups || !teams || !matches) {
    return (
      <PageLayout>
        {breadcrumb}
        <div className="space-y-4 py-8">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </PageLayout>
    );
  }

  // Once the tournament is locked, no role — including super admin — may
  // create a NEW prediction on the user-facing route. (The admin-on-behalf
  // editor passes a different apiBasePath and is intentionally exempt.) This
  // backstops the disabled "New prediction" button on the hub against a direct
  // deep-link to the create wizard. Editing existing predictions is unaffected.
  if (mode === 'create' && isLocked && apiBasePath === '/api/predictions') {
    return (
      <PageLayout>
        {breadcrumb}
        <Card className="mt-6 border-amber-500/40 bg-amber-500/10">
          <CardContent
            role="status"
            className="text-amber-900 dark:text-amber-200 flex flex-col items-center gap-3 py-10 text-center"
          >
            <p className="text-lg font-semibold">Predictions are locked</p>
            <p className="text-sm">
              No further prediction submissions are being accepted.
            </p>
            <Button variant="outline" onClick={() => router.push(ROUTES.predictions)}>
              Back to your predictions
            </Button>
          </CardContent>
        </Card>
      </PageLayout>
    );
  }

  const stepIndex = STEP_ORDER.indexOf(currentStep);
  // Back / Continue target the nearest *unlocked* neighbour so a frozen phase
  // is stepped over rather than landed on.
  const nextUnlockedStep = findAdjacentUnlockedStep(1);
  const prevUnlockedStep = findAdjacentUnlockedStep(-1);
  const isFirstStep = prevUnlockedStep === null;
  const isLastStep = stepIndex === STEP_ORDER.length - 1;
  const currentStepComplete = stepStatus[currentStep];
  const nextStepLabel = nextUnlockedStep ? STEP_LABELS[nextUnlockedStep] : null;
  const previousStepLabel = prevUnlockedStep ? STEP_LABELS[prevUnlockedStep] : null;
  // Bottom-nav action layout for the Gut Feeling Champion step in Phase 1
  // (the final Phase-1 step):
  //   - Regular users: "Save Phase 1 Picks" only. Knockout steps are
  //     read-only in phase 1, so a Continue button would dump them on
  //     disabled screens.
  //   - Super admin (god-mode + may also be participating): BOTH buttons.
  //     "Save Phase 1 Picks" gives them the same end-of-phase-1 commit a
  //     regular participant gets; "Continue to Round 32" keeps the wizard
  //     flow into the knockout bracket (which they can edit thanks to
  //     phase2Editable).
  const isPhase1LastStep =
    phase === 'phase1' && currentStep === 'champion_pick';
  // In a locked, read-only view nothing can be saved or submitted, so hide
  // those buttons entirely. Continue stays visible so users can browse
  // their picks.
  const lockedReadOnly = isLocked && !bypassLockNav;
  const showSavePhase1 = isPhase1LastStep && !lockedReadOnly;
  const showReviewSubmit = isLastStep && !lockedReadOnly;
  const showContinue =
    !isLastStep && (lockedReadOnly || !isPhase1LastStep || isSuperAdmin);
  // Save progress: an explicit "persist now, don't advance" action so a user
  // can checkpoint the current round (Phase 1 or Phase 2) in place. Auto-save
  // still fires on Continue / Back / sub-tab; this covers staying put. Hidden
  // where a dedicated commit button already owns the footer (Phase 1 last
  // step → Save Phase 1 Picks; final/tiebreaker → Submit Prediction) and in a
  // locked read-only view. Reuses persist()'s name + champion validation.
  const showSaveProgressInline =
    !showSavePhase1 && !showReviewSubmit && !lockedReadOnly;
  // Phase 2 only: let the user pull up the FULL prediction (both phases,
  // read-only) at any point in the knockout flow. Needs a persisted prediction
  // to fetch, so it's edit-mode + an existing id.
  const isPhase2 = phase === 'phase2_open' || phase === 'phase2_locked';
  const showPreview = isPhase2 && mode === 'edit' && !!predictionId;

  return (
    <PageLayout>
      {breadcrumb}
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
            {!isLocked && wasSubmitted && autoCommitFailed && (
              <span className="inline-flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-500">
                <Save className="h-3.5 w-3.5" aria-hidden />
                Couldn’t save changes · will retry on next edit
              </span>
            )}
            {!isLocked && wasSubmitted && !autoCommitFailed && lastServerSaveAt && (
              <span className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
                <Save className="h-3.5 w-3.5" aria-hidden />
                Changes saved · {formatClockTime(lastServerSaveAt)}
              </span>
            )}
            {!isLocked && !wasSubmitted && lastSavedAt && (
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

      {lockedReadOnly && (
        <Card className="mb-6 border-amber-500/40 bg-amber-500/10">
          <CardContent
            role="status"
            className="text-amber-900 dark:text-amber-200 py-3 text-sm"
          >
            Predictions are locked — this is a read-only view of your picks. Use the
            stepper or the Continue / Back buttons to browse between sections.
          </CardContent>
        </Card>
      )}

      <Card className="mb-8">
        <CardContent className="space-y-3 py-6">
          <Label htmlFor="prediction-name" className="text-base font-medium">
            Prediction name
            <span className="text-destructive ml-0.5" aria-hidden>*</span>
          </Label>
          <Input
            id="prediction-name"
            ref={nameRef}
            type="text"
            value={predictionName}
            onChange={(e) => handleNameChange(e.target.value)}
            onBlur={() => setPredictionNameTouched(true)}
            // Prediction name is a Phase 1 field — freezes once Phase 1
            // locks, same as group / champion picks. Super admin keeps
            // edit access via `phase1Editable`.
            disabled={!phase1Editable || isSubmitting}
            maxLength={PREDICTION_NAME_MAX}
            aria-invalid={showNameError ? true : undefined}
            aria-describedby={
              showNameError ? 'prediction-name-error' : 'prediction-name-help'
            }
            className={cn(
              'h-12 text-base',
              showNameError && 'border-destructive focus-visible:ring-destructive'
            )}
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

        <div>
          {currentStep === 'champion_pick' && (
            <ChampionPickForm
              teams={teams}
              value={championTeamId}
              onChange={handleChampionTeamIdChange}
              disabled={!phase1Editable}
            />
          )}

          {currentStep === 'groups' && (
            <GroupStageForm
              groups={groups}
              predictions={groupPredictions}
              onPredictionChange={handleGroupPredictionChange}
              onAutofillByFifaRanking={handleAutofillGroupsByFifaRanking}
              onResetGroups={handleResetGroups}
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
              groupStandings={groupStandings}
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
            disabled={isFirstStep || isSavingProgress || isSubmitting}
            className="sm:w-auto"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            {previousStepLabel ? `Back: ${previousStepLabel}` : 'Back'}
          </Button>
          {showPreview && (
            <Button
              type="button"
              variant="outline"
              onClick={handleOpenPreview}
              disabled={isSubmitting || isSavingProgress}
              className="sm:w-auto"
            >
              <Eye className="mr-2 h-4 w-4" />
              Preview prediction
            </Button>
          )}
          <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center">
            {showSaveProgressInline && (
              <Button
                type="button"
                variant="outline"
                onClick={handleSaveProgress}
                disabled={isLocked || isSubmitting || isSavingProgress}
                className="sm:w-auto"
              >
                {isSavingProgress ? 'Saving…' : 'Save progress'}
              </Button>
            )}
            {showSavePhase1 && (
              <Button
                type="button"
                onClick={handleSavePhase1}
                disabled={isLocked || isSavingProgress || isSubmitting}
                className="sm:w-auto"
              >
                {isSavingProgress ? 'Saving…' : 'Save Phase 1 Picks'}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            )}
            {showReviewSubmit && (
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={isLocked || isSubmitting || isSavingProgress}
                className="sm:w-auto"
              >
                {isSubmitting ? 'Submitting…' : 'Submit Prediction'}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            )}
            {showContinue && (
              <Button
                type="button"
                variant={showSavePhase1 ? 'outline' : 'default'}
                onClick={goToNextStep}
                // In a locked read-only view we keep Continue enabled even if
                // the step is "incomplete" — the user is just browsing their
                // past picks and can't edit, so step-completion is moot.
                disabled={
                  (!currentStepComplete && !(isLocked && !bypassLockNav)) ||
                  isSavingProgress ||
                  isSubmitting
                }
                className="sm:w-auto"
              >
                {isSavingProgress
                  ? 'Saving…'
                  : nextStepLabel
                    ? `Continue to ${nextStepLabel}`
                    : 'Continue'}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {showPreview && (
        <BracketPreviewDialog
          predictionId={previewOpen ? (predictionId ?? null) : null}
          apiBasePath={effectiveApiBasePath}
          onOpenChange={setPreviewOpen}
        />
      )}
    </PageLayout>
  );
}
