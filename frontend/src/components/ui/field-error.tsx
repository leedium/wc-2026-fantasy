import * as React from 'react';
import { cn } from '@/lib/utils';

interface FieldErrorProps {
  id: string;
  message: string | null | undefined;
  className?: string;
}

export function FieldError({ id, message, className }: FieldErrorProps) {
  if (!message) return null;
  return (
    <p
      id={id}
      role="alert"
      className={cn('text-destructive text-sm', className)}
    >
      {message}
    </p>
  );
}
