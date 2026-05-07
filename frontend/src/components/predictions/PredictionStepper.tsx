'use client';

import * as React from 'react';
import { Check, CornerDownRight, Lock } from 'lucide-react';

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

export type StepStatus = 'done' | 'current' | 'upcoming' | 'locked';

export interface StepperStep {
  value: string;
  label: string;
  status: StepStatus;
}

interface PredictionStepperProps {
  topSteps: StepperStep[];
  topValue: string;
  onTopChange: (value: string) => void;
  subSteps?: StepperStep[];
  subValue?: string;
  onSubChange?: (value: string) => void;
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

interface StepperRowProps {
  steps: StepperStep[];
  value: string;
  onValueChange: (value: string) => void;
  size?: 'lg' | 'sm';
  testIdPrefix?: string;
}

function StepperRow({
  steps,
  value,
  onValueChange,
  size = 'lg',
  testIdPrefix = 'step-circle',
}: StepperRowProps) {
  const isSm = size === 'sm';
  return (
    <Tabs value={value} onValueChange={onValueChange}>
      <TabsList
        className={cn(
          'grid h-auto w-full gap-0 rounded-none bg-transparent p-0',
          isSm && 'overflow-x-auto'
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
              className={cn(
                'relative flex h-auto flex-col items-center gap-2 rounded-none bg-transparent shadow-none data-[state=active]:bg-transparent data-[state=active]:shadow-none',
                isSm ? 'px-1 py-1' : 'px-2 py-1'
              )}
            >
              {!isFirst && (
                <span
                  aria-hidden
                  className={cn(
                    'absolute left-0 h-0.5 w-1/2 -translate-y-1/2',
                    isSm ? 'top-3' : 'top-4',
                    leftFilled ? 'bg-green-500' : 'bg-muted'
                  )}
                />
              )}
              {!isLast && (
                <span
                  aria-hidden
                  className={cn(
                    'absolute right-0 h-0.5 w-1/2 -translate-y-1/2',
                    isSm ? 'top-3' : 'top-4',
                    rightFilled ? 'bg-green-500' : 'bg-muted'
                  )}
                />
              )}
              <span
                data-testid={`${testIdPrefix}-${step.value}`}
                className={cn(
                  'relative z-10 flex items-center justify-center rounded-full border-2 font-semibold transition-colors',
                  isSm ? 'h-6 w-6 text-xs' : 'h-8 w-8 text-sm',
                  circleClasses[step.status]
                )}
              >
                {step.status === 'done' ? (
                  <Check className={cn(isSm ? 'h-3 w-3' : 'h-4 w-4')} aria-hidden />
                ) : step.status === 'locked' ? (
                  <Lock className={cn(isSm ? 'h-3 w-3' : 'h-3.5 w-3.5')} aria-hidden />
                ) : (
                  index + 1
                )}
              </span>
              <span className={cn(isSm ? 'text-[10px] sm:text-xs' : 'text-xs sm:text-sm', labelClasses[step.status])}>
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
    </Tabs>
  );
}

export function PredictionStepper({
  topSteps,
  topValue,
  onTopChange,
  subSteps,
  subValue,
  onSubChange,
  className,
}: PredictionStepperProps) {
  const showSub = subSteps && subValue !== undefined && onSubChange;

  return (
    <div className={cn('mb-8 space-y-3', className)}>
      <StepperRow
        steps={topSteps}
        value={topValue}
        onValueChange={onTopChange}
        size="lg"
        testIdPrefix="step-circle"
      />
      {showSub && (
        <div
          className="bg-muted/30 rounded-md border border-dashed px-3 py-2"
          data-testid="prediction-substepper"
        >
          <div className="text-muted-foreground mb-1 flex items-center gap-1 text-xs">
            <CornerDownRight className="h-3 w-3" aria-hidden />
            <span>Knockout stages</span>
          </div>
          <StepperRow
            steps={subSteps}
            value={subValue}
            onValueChange={onSubChange}
            size="sm"
            testIdPrefix="substep-circle"
          />
        </div>
      )}
    </div>
  );
}
