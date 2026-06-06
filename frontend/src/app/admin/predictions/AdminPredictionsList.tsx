'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';

import { PageLayout } from '@/components/layout/PageLayout';
import { AdminNav } from '@/components/admin/AdminNav';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface AdminPrediction {
  id: string;
  userId: string;
  username: string;
  email: string | null;
  predictionName: string | null;
  submittedAt: string | null;
  updatedAt: string;
}

interface PredictionsResponse {
  predictions: AdminPrediction[];
  total: number;
  page: number;
  pageSize: number;
}

const PAGE_SIZE = 25;

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

export function AdminPredictionsList() {
  const [search, setSearch] = React.useState('');
  const [debounced, setDebounced] = React.useState('');
  const [page, setPage] = React.useState(1);

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  const query = useQuery<PredictionsResponse>({
    queryKey: ['admin-predictions', debounced, page],
    queryFn: async () => {
      const res = await fetch(
        `/api/admin/predictions?search=${encodeURIComponent(debounced)}&page=${page}&pageSize=${PAGE_SIZE}`
      );
      if (!res.ok) throw new Error('Failed to load predictions');
      return res.json();
    },
  });

  const totalPages = Math.max(1, Math.ceil((query.data?.total ?? 0) / PAGE_SIZE));

  return (
    <PageLayout>
      <h1 className="mb-2 text-3xl font-bold">Admin</h1>
      <AdminNav />

      <Card>
        <CardContent className="space-y-4 p-4">
          <Input
            placeholder="Search email, username, or prediction name…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="max-w-sm"
          />

          {query.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Prediction</TableHead>
                  <TableHead>Saved</TableHead>
                  <TableHead>Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(query.data?.predictions ?? []).map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="text-sm font-medium">{p.email ?? '—'}</div>
                      <div className="text-muted-foreground text-xs">{p.username}</div>
                    </TableCell>
                    <TableCell className="text-sm">{p.predictionName ?? '—'}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDateTime(p.submittedAt)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDateTime(p.updatedAt)}
                    </TableCell>
                  </TableRow>
                ))}
                {(query.data?.predictions ?? []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-muted-foreground py-8 text-center">
                      No predictions found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-muted-foreground text-sm">
                Page {page} of {totalPages} · {query.data?.total ?? 0} predictions
              </p>
              <div className="space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </PageLayout>
  );
}
