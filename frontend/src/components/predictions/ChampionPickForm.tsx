'use client';

import * as React from 'react';
import { CheckCircle2, Circle, Trophy } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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

  // Flat alphabetical list of all 48 teams. SelectGroup/SelectLabel was
  // dropped because sticky group headers in Radix's item-aligned popper
  // jank badly on iOS Safari (the picker visually jumps as the user scrolls).
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
          <p>
            Pick one of the 48 teams as your tournament champion. This is your Phase 1
            commitment — it locks when Phase 1 ends and cannot be changed afterward.
          </p>
          <p>
            <strong>Scoring:</strong> +{SCORING.championPickBonus} bonus points if your pick
            matches the actual champion (winner of the Final). This is independent of your
            bracket Final pick — you can pick the same team for both, or split your bet.
          </p>
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
          <Select
            value={value ?? ''}
            onValueChange={(next) => onChange(next || null)}
            disabled={disabled}
          >
            <SelectTrigger data-testid="champion-pick-select">
              <SelectValue placeholder="Pick a team" />
            </SelectTrigger>
            {/*
              48-item flat list. `item-aligned` opens the dropdown next to the
              trigger with native browser scrolling, so users can wheel/touch/
              swipe through every team without the chevron-scroll quirk of the
              default popper mode.
            */}
            <SelectContent position="item-aligned">
              {sortedTeams.map((team) => (
                <SelectItem key={team.id} value={team.id}>
                  <span className="flex items-center gap-2">
                    <TeamFlag code={team.code} />
                    <span>{team.name}</span>
                    <span className="text-muted-foreground text-xs">
                      ({team.code} · Group {team.group})
                    </span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {pickedTeam && (
            <p className="text-muted-foreground text-xs">
              Your champion:{' '}
              <span className="text-foreground font-medium">{pickedTeam.name}</span>{' '}
              from Group {pickedTeam.group}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
