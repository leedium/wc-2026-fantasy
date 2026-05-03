'use client';

import * as React from 'react';
import { HelpCircle, Target } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

// Validation range for the champion's tournament-goal tally.
// Champion plays 8 matches (3 group + R32 + R16 + QF + SF + Final);
// realistic range is roughly 5-25, with 0-50 as the hard bound.
const MIN_GOALS = 0;
const MAX_GOALS = 50;

interface TiebreakerInputProps {
  value: number | null;
  onChange: (value: number | null) => void;
  disabled?: boolean;
}

export function TiebreakerInput({ value, onChange, disabled = false }: TiebreakerInputProps) {
  const [inputValue, setInputValue] = React.useState(value?.toString() ?? '');
  const [error, setError] = React.useState<string | null>(null);

  // Sync input value when prop changes
  React.useEffect(() => {
    setInputValue(value?.toString() ?? '');
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    setInputValue(rawValue);

    // Allow empty input
    if (rawValue === '') {
      setError(null);
      onChange(null);
      return;
    }

    // Parse as integer
    const parsed = parseInt(rawValue, 10);

    // Check if valid number
    if (isNaN(parsed)) {
      setError('Please enter a valid number');
      onChange(null);
      return;
    }

    // Check range
    if (parsed < MIN_GOALS || parsed > MAX_GOALS) {
      setError(`Goals must be between ${MIN_GOALS} and ${MAX_GOALS}`);
      onChange(null);
      return;
    }

    // Valid input
    setError(null);
    onChange(parsed);
  };

  const isValid = value !== null && error === null;

  return (
    <Card className={cn(isValid && 'border-green-500/50 bg-green-500/5 dark:bg-green-500/10')}>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Target className="text-primary h-5 w-5" />
          <CardTitle className="text-base">Tiebreaker: Champion&apos;s Total Goals</CardTitle>
        </div>
        <CardDescription>
          Predict the total goals the World Cup champion scores across their 8 tournament matches
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="total-goals">Champion&apos;s Total Goals</Label>
          <Input
            id="total-goals"
            type="number"
            placeholder={`Enter a number (${MIN_GOALS}-${MAX_GOALS})`}
            value={inputValue}
            onChange={handleChange}
            disabled={disabled}
            min={MIN_GOALS}
            max={MAX_GOALS}
            className={cn(error && 'border-red-500 focus-visible:ring-red-500 dark:border-red-400')}
            aria-describedby="tiebreaker-help tiebreaker-error"
            aria-invalid={!!error}
          />
          {error && (
            <p id="tiebreaker-error" className="text-sm text-red-500 dark:text-red-400">
              {error}
            </p>
          )}
        </div>

        <div
          id="tiebreaker-help"
          className="bg-muted/50 flex items-start gap-2 rounded-md p-3 text-sm"
        >
          <HelpCircle className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
          <div className="text-muted-foreground space-y-1">
            <p>
              <strong>How it works:</strong> if two or more players are tied on total points, the
              prediction closest to the champion&apos;s actual goal tally wins the tie.
            </p>
            <p className="text-xs">
              Counts every goal the champion scores in regulation and extra time across all 8 of
              their matches (group stage through final). Penalty-shootout goals don&apos;t count.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
