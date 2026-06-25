'use client';

import Link from 'next/link';
import { Trophy } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getRankBadge } from '@/components/leaderboard/rankBadge';
import { Phase1WinnersCard } from '@/components/leaderboard/Phase1WinnersCard';
import { usePhase1Winners } from '@/hooks/usePhase1Winners';
import { PRIZES, ROUTES, formatPrizeCAD } from '@/lib/constants';
import { cn } from '@/lib/utils';

type PrizePhase = 'phase1' | 'phase2';

const PHASE_META: Record<PrizePhase, { title: string; blurb: string }> = {
  phase1: {
    title: 'Phase 1 — Group Stage',
    blurb: 'Top 3 on the group-stage standings.',
  },
  phase2: {
    title: 'Phase 2 — Knockout',
    blurb: 'Top 5 on the final knockout standings.',
  },
};

function PrizeCard({ phase, active }: { phase: PrizePhase; active?: boolean }) {
  const meta = PHASE_META[phase];
  return (
    <Card className={cn(active && 'border-primary ring-primary/30 ring-1')}>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          <Trophy className="text-primary h-5 w-5" />
          {meta.title}
          {active && <Badge variant="secondary">Active now</Badge>}
        </CardTitle>
        <p className="text-muted-foreground text-sm">{meta.blurb}</p>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-24">Place</TableHead>
              <TableHead className="text-right">Prize</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {PRIZES[phase].map((prize) => {
              const badge = getRankBadge(prize.rank);
              return (
                <TableRow key={prize.rank}>
                  <TableCell>
                    {badge && (
                      <Badge className={cn('gap-1', badge.color)}>
                        <Trophy className="h-3 w-3" />
                        {badge.label}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatPrizeCAD(prize.amountCAD)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export interface PrizeTablesProps {
  /**
   * Optionally emphasize the currently-active phase's card with a ring + "Active
   * now" badge. Omit (e.g. on the dedicated /prizes page) to render both neutrally.
   */
  activePhase?: PrizePhase;
  className?: string;
}

/**
 * Side-by-side Phase 1 / Phase 2 prize tables. Single source of truth for prize
 * rendering, shared by the /prizes page and the leaderboard. Once an admin has
 * snapshotted the Phase 1 winners, the actual winners table replaces the generic
 * Phase 1 prize card in place (Phase 2 stays a prize card until its own results).
 */
export function PrizeTables({ activePhase, className }: PrizeTablesProps) {
  const { winners } = usePhase1Winners();
  const hasPhase1Winners = winners.length > 0;
  return (
    <div className={className}>
      <div className="grid gap-4 sm:grid-cols-2">
        {hasPhase1Winners ? (
          <Phase1WinnersCard />
        ) : (
          <PrizeCard phase="phase1" active={activePhase === 'phase1'} />
        )}
        <PrizeCard phase="phase2" active={activePhase === 'phase2'} />
      </div>
      <p className="text-muted-foreground mt-3 text-xs">
        These amounts already have the per-entry portion sent to{' '}
        <Link href={ROUTES.charities} className="hover:text-foreground underline">
          charity
        </Link>{' '}
        and{' '}
        <Link href={ROUTES.audit} className="hover:text-foreground underline">
          management fees
        </Link>{' '}
        deducted.
      </p>
    </div>
  );
}
