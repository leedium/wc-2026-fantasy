'use client';

import { Trophy } from 'lucide-react';

import { getRankBadge } from '@/components/leaderboard/rankBadge';
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
import { usePhase1Winners } from '@/hooks/usePhase1Winners';
import { PRIZES, formatPrizeCAD } from '@/lib/constants';
import { cn } from '@/lib/utils';

/**
 * The frozen Phase 1 (group + advancer) top 3, snapshotted by an admin when Phase
 * 2 opens. Renders nothing until a snapshot exists, so it only appears once the
 * winners are locked in. Styled to match PrizeCard in shared/PrizeTables.tsx.
 */
export function Phase1WinnersCard({ className }: { className?: string }) {
  const { winners } = usePhase1Winners();

  if (winners.length === 0) return null;

  return (
    <Card className={cn('border-primary ring-primary/30 ring-1', className)}>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          <Trophy className="text-primary h-5 w-5" />
          Phase 1 Winners
          <Badge variant="secondary">Final</Badge>
        </CardTitle>
        <p className="text-muted-foreground text-sm">
          Frozen top 3 on the group-stage standings (group + Best&nbsp;3rds advancer points).
        </p>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-24">Place</TableHead>
              <TableHead>Entry</TableHead>
              <TableHead className="text-right">Points</TableHead>
              <TableHead className="text-right">Prize</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {winners.map((winner) => {
              const badge = getRankBadge(winner.rank);
              const prize = PRIZES.phase1.find((p) => p.rank === winner.rank);
              return (
                <TableRow key={winner.predictionId}>
                  <TableCell>
                    {badge && (
                      <Badge className={cn('gap-1', badge.color)}>
                        <Trophy className="h-3 w-3" />
                        {badge.label}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="font-medium">{winner.predictionName}</span>
                    <span className="text-muted-foreground ml-1 text-xs">
                      @{winner.username}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {winner.phase1Points}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {prize ? formatPrizeCAD(prize.amountCAD) : '—'}
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
