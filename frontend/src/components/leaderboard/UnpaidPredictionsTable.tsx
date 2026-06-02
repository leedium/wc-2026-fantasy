'use client';

import * as React from 'react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ROUTES } from '@/lib/constants';

export interface UnpaidPrediction {
  id: string;
  name: string;
  submittedAt: string | null;
}

function formatTime(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

/**
 * Read-only table of the signed-in user's submitted-but-unpaid predictions,
 * shown directly above the public leaderboard (which only lists paid entries).
 * Purpose-built rather than reusing `LeaderboardTable` — these rows have no
 * rank/points and exist to nudge payment. Every row is red-tinted to contrast
 * with the normal ranked rows below.
 */
export function UnpaidPredictionsTable({
  predictions,
  isLocked,
}: {
  predictions: UnpaidPrediction[];
  isLocked: boolean;
}) {
  if (predictions.length === 0) return null;

  return (
    <Card className="mb-6 border-red-500/40">
      <CardHeader className="pb-2">
        <CardTitle className="text-base text-red-900 dark:text-red-200">
          Your unpaid predictions — not ranked yet
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Prediction</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Submitted</TableHead>
              {!isLocked && <TableHead className="text-right">Action</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {predictions.map((p) => (
              <TableRow
                key={p.id}
                className="bg-red-500/5 hover:bg-red-500/10 dark:bg-red-500/10 dark:hover:bg-red-500/15"
              >
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell>
                  <Badge variant="destructive">Payment pending — not ranked</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatTime(p.submittedAt)}
                </TableCell>
                {!isLocked && (
                  <TableCell className="text-right">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`${ROUTES.predictions}/${encodeURIComponent(p.id)}`}>
                        Edit
                      </Link>
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
