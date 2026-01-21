import { PageLayout } from '@/components/layout/PageLayout';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function ClaimsLoading() {
  return (
    <PageLayout>
      <div className="flex flex-col items-center justify-center py-12">
        {/* Page Title Skeleton */}
        <Skeleton className="mb-8 h-9 w-32" />

        {/* Coming Soon Card Skeleton */}
        <Card className="w-full max-w-lg text-center">
          <CardHeader className="pb-4">
            <div className="mx-auto mb-4">
              <Skeleton className="h-20 w-20 rounded-full" />
            </div>
            <Skeleton className="mx-auto mb-2 h-7 w-40" />
            <Skeleton className="mx-auto h-5 w-56" />
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Explanation Skeleton */}
            <div className="bg-muted/50 flex items-start gap-3 rounded-lg p-4 text-left">
              <Skeleton className="mt-0.5 h-5 w-5 flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            </div>

            {/* What to do in the meantime Skeleton */}
            <div className="space-y-3">
              <Skeleton className="h-4 w-32" />
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-4" />
                  <Skeleton className="h-4 w-56" />
                </div>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-4" />
                  <Skeleton className="h-4 w-64" />
                </div>
              </div>
            </div>

            {/* Button Skeleton */}
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  );
}
