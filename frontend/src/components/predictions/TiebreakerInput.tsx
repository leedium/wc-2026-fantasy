'use client';

import * as React from 'react';
import { HelpCircle, Target } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

// Validation range for total goals
const MIN_GOALS = 100;
const MAX_GOALS = 300;

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

    // Check if positive integer
    if (parsed <= 0) {
      setError('Goals must be a positive number');
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
    <Card className={cn(isValid && 'border-green-500/50 bg-green-500/5')}>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Target className="text-primary h-5 w-5" />
          <CardTitle className="text-base">Tiebreaker: Total Goals</CardTitle>
        </div>
        <CardDescription>
          Predict the total number of goals scored in the entire tournament
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="total-goals">Total Goals Prediction</Label>
          <Input
            id="total-goals"
            type="number"
            placeholder={`Enter a number (${MIN_GOALS}-${MAX_GOALS})`}
            value={inputValue}
            onChange={handleChange}
            disabled={disabled}
            min={MIN_GOALS}
            max={MAX_GOALS}
            className={cn(error && 'border-red-500 focus-visible:ring-red-500')}
            aria-describedby="tiebreaker-help tiebreaker-error"
            aria-invalid={!!error}
          />
          {error && (
            <p id="tiebreaker-error" className="text-sm text-red-500">
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
              <strong>How it works:</strong> If two or more players have the same total points, the
              tiebreaker determines rankings.
            </p>
            <p>The player whose prediction is closest to the actual total goals wins the tie.</p>
            <p className="text-xs">
              Hint: World Cup 2022 had 172 goals in 64 matches. WC2026 will have 104 matches.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
