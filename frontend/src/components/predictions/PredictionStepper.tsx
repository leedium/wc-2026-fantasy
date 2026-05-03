'use client';

import * as React from 'react';
import { Check, Lock } from 'lucide-react';

import { TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

export type StepStatus = 'done' | 'current' | 'upcoming' | 'locked';

export interface StepperStep {
  value: string;
  label: string;
  status: StepStatus;
}

interface PredictionStepperProps {
  steps: StepperStep[];
  className?: string;
}

const circleClasses: Record<StepStatus, string> = {
  done: 'bg-green-500 border-green-500 text-white',
  current: 'bg-background border-primary text-foreground ring-4 ring-primary/15',
  upcoming: 'bg-muted border-muted text-muted-foreground',
  locked: 'bg-muted border-muted text-muted-foreground opacity-60',
};

const labelClasses: Record<StepStatus, string> = {
  done: 'text-foreground',
  current: 'text-foreground font-semibold',
  upcoming: 'text-muted-foreground',
  locked: 'text-muted-foreground line-through',
};

export function PredictionStepper({ steps, className }: PredictionStepperProps) {
  return (
    <TabsList
      className={cn(
        'mb-8 grid h-auto w-full gap-0 rounded-none bg-transparent p-0',
        className
      )}
      style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}
    >
      {steps.map((step, index) => {
        const isFirst = index === 0;
        const isLast = index === steps.length - 1;
        const leftFilled = !isFirst && steps[index - 1].status === 'done';
        const rightFilled = !isLast && step.status === 'done';
        return (
          <TabsTrigger
            key={step.value}
            value={step.value}
            disabled={step.status === 'locked'}
            data-status={step.status}
            className="relative flex h-auto flex-col items-center gap-2 rounded-none bg-transparent px-2 py-1 shadow-none data-[state=active]:bg-transparent data-[state=active]:shadow-none"
          >
            {!isFirst && (
              <span
                aria-hidden
                className={cn(
                  'absolute top-4 left-0 h-0.5 w-1/2 -translate-y-1/2',
                  leftFilled ? 'bg-green-500' : 'bg-muted'
                )}
              />
            )}
            {!isLast && (
              <span
                aria-hidden
                className={cn(
                  'absolute top-4 right-0 h-0.5 w-1/2 -translate-y-1/2',
                  rightFilled ? 'bg-green-500' : 'bg-muted'
                )}
              />
            )}
            <span
              data-testid={`step-circle-${step.value}`}
              className={cn(
                'relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors',
                circleClasses[step.status]
              )}
            >
              {step.status === 'done' ? (
                <Check className="h-4 w-4" aria-hidden />
              ) : step.status === 'locked' ? (
                <Lock className="h-3.5 w-3.5" aria-hidden />
              ) : (
                index + 1
              )}
            </span>
            <span className={cn('text-xs sm:text-sm', labelClasses[step.status])}>
              {step.label}
            </span>
            <span className="sr-only">
              Step {index + 1} of {steps.length}
              {step.status === 'done' && ' (complete)'}
              {step.status === 'current' && ' (current)'}
              {step.status === 'locked' && ' (locked)'}
            </span>
          </TabsTrigger>
        );
      })}
    </TabsList>
  );
}
