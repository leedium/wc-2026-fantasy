import { PageLayout } from '@/components/layout/PageLayout';
import { Skeleton } from '@/components/ui/skeleton';

export default function ResultsLoading() {
  return (
    <PageLayout>
      <div className="mb-8">
        <Skeleton className="mb-2 h-9 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="space-y-10">
        {Array.from({ length: 3 }).map((_, section) => (
          <div key={section} className="space-y-4">
            <Skeleton className="h-6 w-56" />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-40 w-full" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </PageLayout>
  );
}
