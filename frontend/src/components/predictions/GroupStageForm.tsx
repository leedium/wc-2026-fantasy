'use client';

import * as React from 'react';
import { CheckCircle2, Circle } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { mockGroups } from '@/lib/mock-data';
import type { Group, GroupPrediction, Team } from '@/types/tournament';

// Position labels for display
const POSITION_LABELS = {
  first: '1st',
  second: '2nd',
  third: '3rd',
  fourth: '4th',
} as const;

type PositionKey = keyof typeof POSITION_LABELS;

interface GroupStageFormProps {
  predictions: GroupPrediction[];
  onPredictionChange: (groupId: string, position: PositionKey, teamId: string | null) => void;
  disabled?: boolean;
}

// Single group card component
function GroupCard({
  group,
  prediction,
  onPositionChange,
  disabled,
}: {
  group: Group;
  prediction: GroupPrediction;
  onPositionChange: (position: PositionKey, teamId: string | null) => void;
  disabled?: boolean;
}) {
  // Get selected team IDs for this group
  const selectedTeamIds = new Set(
    Object.values(prediction.positions).filter((id): id is string => id !== null)
  );

  // Check if group is complete (all 4 positions filled)
  const isComplete = selectedTeamIds.size === 4;

  // Get available teams for a position (not selected in other positions)
  const getAvailableTeams = (position: PositionKey): Team[] => {
    const currentSelection = prediction.positions[position];
    return group.teams.filter(
      (team) => team.id === currentSelection || !selectedTeamIds.has(team.id)
    );
  };

  return (
    <Card className={cn(isComplete && 'border-green-500/50 bg-green-500/5')}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{group.name}</CardTitle>
          {isComplete ? (
            <Badge variant="default" className="bg-green-600">
              <CheckCircle2 className="mr-1 h-3 w-3" />
              Complete
            </Badge>
          ) : (
            <Badge variant="secondary">
              <Circle className="mr-1 h-3 w-3" />
              {selectedTeamIds.size}/4
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {(Object.keys(POSITION_LABELS) as PositionKey[]).map((position) => {
          const availableTeams = getAvailableTeams(position);
          const selectedValue = prediction.positions[position];

          return (
            <div key={position} className="flex items-center gap-3">
              <span className="text-muted-foreground w-10 text-sm font-medium">
                {POSITION_LABELS[position]}
              </span>
              <Select
                value={selectedValue ?? ''}
                onValueChange={(value) => onPositionChange(position, value || null)}
                disabled={disabled}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select team" />
                </SelectTrigger>
                <SelectContent>
                  {availableTeams.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      <span className="flex items-center gap-2">
                        <span className="text-muted-foreground font-mono text-xs">{team.code}</span>
                        <span>{team.name}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

export function GroupStageForm({
  predictions,
  onPredictionChange,
  disabled = false,
}: GroupStageFormProps) {
  // Calculate completion stats
  const completedGroups = predictions.filter((p) => {
    const filledPositions = Object.values(p.positions).filter((v) => v !== null).length;
    return filledPositions === 4;
  }).length;

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Group Stage Predictions</h3>
        <Badge variant={completedGroups === 12 ? 'default' : 'secondary'}>
          {completedGroups} / 12 groups complete
        </Badge>
      </div>

      {/* Groups Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {mockGroups.map((group) => {
          const prediction = predictions.find((p) => p.groupId === group.id);
          if (!prediction) return null;

          return (
            <GroupCard
              key={group.id}
              group={group}
              prediction={prediction}
              onPositionChange={(position, teamId) =>
                onPredictionChange(group.id, position, teamId)
              }
              disabled={disabled}
            />
          );
        })}
      </div>

      {/* Helper Text */}
      <p className="text-muted-foreground text-sm">
        Predict the final standings for each group. Select which team will finish 1st, 2nd, 3rd, and
        4th. Each team can only be selected once per group.
      </p>
    </div>
  );
}
