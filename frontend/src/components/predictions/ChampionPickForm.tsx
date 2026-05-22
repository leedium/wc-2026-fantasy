'use client';

import * as React from 'react';
import { CheckCircle2, Circle, Trophy } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TeamFlag } from '@/components/shared/TeamFlag';
import { SCORING } from '@/lib/constants';
import { cn } from '@/lib/utils';
import type { Team } from '@/types/tournament';

export interface ChampionPickFormProps {
  teams: Team[];
  value: string | null;
  onChange: (teamId: string | null) => void;
  disabled?: boolean;
}

export function ChampionPickForm({
  teams,
  value,
  onChange,
  disabled = false,
}: ChampionPickFormProps) {
  const filled = !!value;
  const pickedTeam = filled ? (teams.find((t) => t.id === value) ?? null) : null;

  // Flat alphabetical list of all 48 teams. Rendered into a native <select>
  // so iOS users get the platform wheel picker (rock-solid; Radix's overlay
  // jittered badly on iOS Safari with a 48-item list).
  const sortedTeams = React.useMemo(
    () => [...teams].sort((a, b) => a.name.localeCompare(b.name)),
    [teams]
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Your Gut Feeling Champion</h3>
        <Badge variant={filled ? 'default' : 'secondary'} className={cn(filled && 'bg-green-600')}>
          {filled ? (
            <>
              <CheckCircle2 className="mr-1 h-3 w-3" />
              Set
            </>
          ) : (
            <>
              <Circle className="mr-1 h-3 w-3" />
              Not picked
            </>
          )}
        </Badge>
      </div>

      <details className="group bg-muted/40 rounded-md border px-4 py-3 open:pb-4" open>
        <summary className="cursor-pointer list-none text-sm font-medium select-none [&::-webkit-details-marker]:hidden">
          <span className="inline-flex items-center gap-1.5">
            <span className="text-muted-foreground transition-transform group-open:rotate-90">▶</span>
            How is this scored?
          </span>
        </summary>
        <div className="text-muted-foreground mt-3 space-y-2 text-sm">
          <p>Select your Phase 1 Champion Pick before the tournament begins.</p>
          <p>
            This pick locks at kickoff of the opening match. Once the playoffs begin, you may
            submit a new Phase 2 Champion Pick.
          </p>
          <p>
            <strong>Bonus:</strong> +{SCORING.championPickBonus} points if your pick wins the
            tournament.
          </p>
          <p>Separate from your bracket Final pick.</p>
        </div>
      </details>

      <Card
        className={cn(
          'mx-auto max-w-md',
          filled && 'border-green-500/50 bg-green-500/5 dark:bg-green-500/10'
        )}
        data-testid="champion-pick-card"
      >
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Trophy className="h-4 w-4 text-amber-500" aria-hidden />
            Your champion
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <select
            data-testid="champion-pick-select"
            aria-label="Champion team"
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value || null)}
            disabled={disabled}
            className={cn(
              'border-input ring-offset-background focus:ring-ring flex h-9 w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-sm focus:ring-1 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50',
              !value && 'text-muted-foreground'
            )}
          >
            <option value="" disabled hidden>
              Pick a team
            </option>
            {sortedTeams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name} ({team.code} · Group {team.group})
              </option>
            ))}
          </select>
          {pickedTeam && (
            <p className="text-muted-foreground flex flex-wrap items-center gap-1.5 text-xs">
              Your champion:
              <TeamFlag code={pickedTeam.code} />
              <span className="text-foreground font-medium">{pickedTeam.name}</span>
              from Group {pickedTeam.group}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
