import { PageLayout } from '@/components/layout/PageLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function LeaderboardLoading() {
  return (
    <PageLayout>
      {/* Page Header Skeleton */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Skeleton className="mb-2 h-9 w-48" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
      </div>

      {/* Leaderboard Table Skeleton */}
      <Card className="mb-6">
        <CardContent className="p-0">
          <div className="space-y-0">
            {/* Table Header Skeleton */}
            <div className="flex items-center gap-4 border-b px-4 py-3">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="ml-auto h-4 w-16" />
              <Skeleton className="h-4 w-16" />
            </div>

            {/* Table Rows Skeleton */}
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 border-b px-4 py-3 last:border-b-0">
                <Skeleton className="h-6 w-12" />
                <Skeleton className="h-4 w-28" />
                <Skeleton className="ml-auto h-4 w-14" />
                <Skeleton className="h-4 w-12" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Pagination Skeleton */}
      <div className="flex items-center justify-center gap-2">
        <Skeleton className="h-9 w-9" />
        <Skeleton className="h-9 w-9" />
        <Skeleton className="h-9 w-9" />
        <Skeleton className="h-9 w-9" />
        <Skeleton className="h-9 w-9" />
      </div>
    </PageLayout>
  );
}
