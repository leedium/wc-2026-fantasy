'use client';

import * as React from 'react';
import Link from 'next/link';
import { Eye, Pencil, TrendingDown, TrendingUp, Minus, Trophy } from 'lucide-react';
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
import { getRankBadge } from '@/components/leaderboard/rankBadge';
import { ROUTES } from '@/lib/constants';
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
  /**
   * When true, the viewer may preview rows that aren't their own. When false,
   * other players' Preview buttons render faded + disabled (own rows stay
   * clickable). Gates copying picks while predictions are still editable —
   * the RPC enforces the same rule, this is just the matching affordance.
   */
  canPreviewOthers?: boolean;
  /**
   * When true, render an Edit button on the current user's own rows that
   * deep-links to the prediction editor. Callers should only pass this while
   * the tournament is unlocked (predictions are editable). Row ownership is
   * still gated on `currentUsername` so other players' rows never get one.
   */
  enableEdit?: boolean;
  /**
   * Number of top finishing positions that win a prize, used to flag the
   * prize-winning rows with a coloured rank badge. Phase 1 pays the top 3, so
   * 4th/5th stay un-flagged; once Phase 2 begins the leaderboard passes 5 so
   * 4th and 5th light up too. Defaults to 3.
   */
  prizeRankCutoff?: number;
}

function formatUpdated(value?: string | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
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
  canPreviewOthers = false,
  enableEdit = false,
  prizeRankCutoff = 3,
}: LeaderboardTableProps) {
  const [previewId, setPreviewId] = React.useState<string | null>(null);

  // One shared trailing actions column holds Preview (all rows) and Edit
  // (the current user's own rows). Render it whenever either is enabled.
  const showActions = enablePreview || enableEdit;
  const colCount = showActions ? 5 : 4;

  return (
    <>
      <Table className={className}>
        <TableHeader>
          <TableRow>
            <TableHead className="w-20">Rank</TableHead>
            <TableHead>Player</TableHead>
            <TableHead className="text-right">Points</TableHead>
            <TableHead className="w-24 text-right">Change</TableHead>
            {showActions && <TableHead className="w-36 text-right">Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((entry, index) => {
            const isCurrentUser =
              currentUsername && entry.username.toLowerCase() === currentUsername.toLowerCase();
            const isHighlighted = highlightedRank && entry.rank === highlightedRank;
            // Only flag rows that actually win a prize this phase — beyond the
            // cutoff the rank shows as plain text.
            const rankBadge = entry.rank <= prizeRankCutoff ? getRankBadge(entry.rank) : null;
            const isEvenRow = index % 2 === 0;
            const canPreviewThisRow = isCurrentUser || canPreviewOthers;

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
                    {formatUpdated(entry.updatedAt) && (
                      <span className="text-muted-foreground/80 text-xs">
                        Updated {formatUpdated(entry.updatedAt)}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <span className="font-semibold">{entry.points}</span>
                  <span className="text-muted-foreground ml-1 text-xs">pts</span>
                </TableCell>
                <TableCell className="text-right">
                  <ChangeIndicator change={entry.change} />
                </TableCell>
                {showActions && (
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {enablePreview &&
                        (canPreviewThisRow ? (
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
                        ) : (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled
                            className="cursor-not-allowed opacity-50"
                            aria-label={`Previewing ${entry.predictionName}'s bracket unlocks once the group stage locks`}
                            title="Previewing other players' brackets unlocks once the group stage locks"
                          >
                            <Eye className="mr-1.5 h-4 w-4" />
                            Preview
                          </Button>
                        ))}
                      {enableEdit && isCurrentUser && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          asChild
                          aria-label={`Edit ${entry.predictionName}`}
                        >
                          <Link href={`${ROUTES.predictions}/${entry.predictionId}`}>
                            <Pencil className="mr-1.5 h-4 w-4" />
                            Edit
                          </Link>
                        </Button>
                      )}
                    </div>
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
