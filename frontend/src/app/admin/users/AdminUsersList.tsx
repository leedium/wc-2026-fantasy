'use client';

import * as React from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { PageLayout } from '@/components/layout/PageLayout';
import { AdminNav } from '@/components/admin/AdminNav';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface AdminUser {
  id: string;
  username: string;
  isAdmin: boolean;
  hasPrediction: boolean;
  submittedAt: string | null;
}

interface UsersResponse {
  users: AdminUser[];
  total: number;
  page: number;
  pageSize: number;
}

const PAGE_SIZE = 25;

export function AdminUsersList() {
  const queryClient = useQueryClient();
  const [search, setSearch] = React.useState('');
  const [debounced, setDebounced] = React.useState('');
  const [page, setPage] = React.useState(1);

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  const query = useQuery<UsersResponse>({
    queryKey: ['admin-users', debounced, page],
    queryFn: async () => {
      const res = await fetch(
        `/api/admin/users?search=${encodeURIComponent(debounced)}&page=${page}&pageSize=${PAGE_SIZE}`
      );
      if (!res.ok) throw new Error('Failed to load users');
      return res.json();
    },
  });

  const totalPages = Math.max(1, Math.ceil((query.data?.total ?? 0) / PAGE_SIZE));

  const toggleAdmin = async (user: AdminUser) => {
    try {
      const res = await fetch(`/api/admin/users/${user.id}/admin`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isAdmin: !user.isAdmin }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Failed');
      }
      toast.success(`${user.username} ${!user.isAdmin ? 'promoted to admin' : 'demoted'}`);
      await queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  };

  return (
    <PageLayout>
      <h1 className="mb-2 text-3xl font-bold">Admin</h1>
      <AdminNav />

      <Card>
        <CardContent className="space-y-4 p-4">
          <Input
            placeholder="Search username…"
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
                  <TableHead>Username</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(query.data?.users ?? []).map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.username}</TableCell>
                    <TableCell>
                      {u.isAdmin ? <Badge>admin</Badge> : <Badge variant="outline">user</Badge>}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {u.hasPrediction ? (u.submittedAt ?? 'yes') : '—'}
                    </TableCell>
                    <TableCell className="space-x-2 text-right">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/admin/users/${u.id}`}>View bracket</Link>
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => toggleAdmin(u)}>
                        {u.isAdmin ? 'Demote' : 'Promote'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {(query.data?.users ?? []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-muted-foreground py-8 text-center">
                      No users found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-muted-foreground text-sm">
                Page {page} of {totalPages} · {query.data?.total ?? 0} users
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
