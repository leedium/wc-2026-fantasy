'use client';

import * as React from 'react';
import { Eye, TrendingDown, TrendingUp, Minus, Trophy } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BracketPreviewDialog } from '@/components/predictions/BracketPreviewDialog';
import { cn } from '@/lib/utils';
import type { LeaderboardEntry } from '@/types/tournament';

export interface LeaderboardTableProps {
  entries: LeaderboardEntry[];
  currentUsername?: string | null;
  highlightedRank?: number | null;
  className?: string;
  /**
   * When true, render a Preview button per row that opens the bracket
   * preview dialog. Server-side, the dialog only resolves the bracket for
   * paid + submitted predictions, so all leaderboard rows are eligible.
   * The route requires auth; gate the column visually too.
   */
  enablePreview?: boolean;
}

function getRankBadge(rank: number): { color: string; label: string } | null {
  switch (rank) {
    case 1:
      return { color: 'bg-yellow-500 text-yellow-950', label: '1st' };
    case 2:
      return { color: 'bg-gray-400 dark:bg-gray-300 text-gray-950', label: '2nd' };
    case 3:
      return { color: 'bg-amber-600 text-amber-950', label: '3rd' };
    default:
      return null;
  }
}

function ChangeIndicator({ change }: { change: number }) {
  if (change > 0) {
    return (
      <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
        <TrendingUp className="h-4 w-4" />
        <span className="text-sm">+{change}</span>
      </span>
    );
  }
  if (change < 0) {
    return (
      <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
        <TrendingDown className="h-4 w-4" />
        <span className="text-sm">{change}</span>
      </span>
    );
  }
  return (
    <span className="text-muted-foreground flex items-center gap-1">
      <Minus className="h-4 w-4" />
      <span className="text-sm">-</span>
    </span>
  );
}

export function LeaderboardTable({
  entries,
  currentUsername,
  highlightedRank,
  className,
  enablePreview = false,
}: LeaderboardTableProps) {
  const [previewId, setPreviewId] = React.useState<string | null>(null);

  const colCount = enablePreview ? 5 : 4;

  return (
    <>
      <Table className={className}>
        <TableHeader>
          <TableRow>
            <TableHead className="w-20">Rank</TableHead>
            <TableHead>Player</TableHead>
            <TableHead className="text-right">Points</TableHead>
            <TableHead className="w-24 text-right">Change</TableHead>
            {enablePreview && <TableHead className="w-24 text-right">Bracket</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((entry, index) => {
            const isCurrentUser =
              currentUsername && entry.username.toLowerCase() === currentUsername.toLowerCase();
            const isHighlighted = highlightedRank && entry.rank === highlightedRank;
            const rankBadge = getRankBadge(entry.rank);
            const isEvenRow = index % 2 === 0;

            return (
              <TableRow
                key={entry.predictionId}
                id={`rank-${entry.rank}`}
                className={cn(
                  isEvenRow && 'bg-muted/30',
                  isCurrentUser && 'bg-primary/10 hover:bg-primary/15',
                  isHighlighted && 'ring-primary ring-2 ring-inset'
                )}
              >
                <TableCell className="font-medium">
                  {rankBadge ? (
                    <Badge className={cn('gap-1', rankBadge.color)}>
                      <Trophy className="h-3 w-3" />
                      {rankBadge.label}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">{entry.rank}</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span
                      className={cn(
                        'text-sm font-medium',
                        isCurrentUser && 'text-primary font-semibold'
                      )}
                    >
                      {entry.predictionName}
                      {isCurrentUser && (
                        <span className="text-muted-foreground ml-2 text-xs">(You)</span>
                      )}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {entry.email ?? entry.username}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <span className="font-semibold">{entry.points}</span>
                  <span className="text-muted-foreground ml-1 text-xs">pts</span>
                </TableCell>
                <TableCell className="text-right">
                  <ChangeIndicator change={entry.change} />
                </TableCell>
                {enablePreview && (
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setPreviewId(entry.predictionId)}
                      aria-label={`Preview ${entry.predictionName}'s bracket`}
                    >
                      <Eye className="mr-1.5 h-4 w-4" />
                      Preview
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            );
          })}
          {entries.length === 0 && (
            <TableRow>
              <TableCell colSpan={colCount} className="text-muted-foreground h-24 text-center">
                No entries found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {enablePreview && (
        <BracketPreviewDialog
          predictionId={previewId}
          apiBasePath="/api/leaderboard/prediction"
          onOpenChange={(open) => {
            if (!open) setPreviewId(null);
          }}
        />
      )}
    </>
  );
}
