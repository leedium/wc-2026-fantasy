import * as React from 'react';

import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Compact metric card: icon + label header, large value, optional subtitle.
 * Shared by the admin dashboard and the /audit transparency page.
 */
export function StatCard({
  icon: Icon,
  label,
  value,
  subtitle,
  isLoading,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
  subtitle?: React.ReactNode;
  isLoading?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription className="flex items-center gap-2">
          <Icon className="h-4 w-4" />
          {label}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-8 w-20" />
        ) : (
          <>
            <div className="text-2xl font-bold">{value}</div>
            {subtitle ? (
              <p className="text-muted-foreground mt-1 text-xs">{subtitle}</p>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
