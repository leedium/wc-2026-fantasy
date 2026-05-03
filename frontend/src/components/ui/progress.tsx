'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number | null;
  max?: number;
  indicatorClassName?: string;
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value, max = 100, indicatorClassName, ...props }, ref) => {
    const safeMax = max <= 0 ? 100 : max;
    const safeValue = value == null ? 0 : Math.max(0, Math.min(safeMax, value));
    const percent = (safeValue / safeMax) * 100;
    return (
      <div
        ref={ref}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={safeMax}
        aria-valuenow={safeValue}
        className={cn('bg-muted relative h-2 w-full overflow-hidden rounded-full', className)}
        {...props}
      >
        <div
          className={cn('bg-primary h-full transition-transform duration-300', indicatorClassName)}
          style={{ transform: `translateX(-${100 - percent}%)` }}
        />
      </div>
    );
  }
);
Progress.displayName = 'Progress';

export { Progress };
