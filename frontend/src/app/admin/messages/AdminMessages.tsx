'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, Mail, Send, X } from 'lucide-react';

import { PageLayout } from '@/components/layout/PageLayout';
import { AdminNav } from '@/components/admin/AdminNav';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

// 'user' is a UI-only option (a single hand-picked recipient); the other four
// map to the admin_list_recipient_emails segments.
const SEGMENTS = [
  { key: 'all', label: 'All users' },
  { key: 'no_prediction', label: 'No prediction' },
  { key: 'unpaid', label: 'Prediction, unpaid' },
  { key: 'paid', label: 'Paid' },
  { key: 'user', label: 'Specific user' },
] as const;
type Segment = (typeof SEGMENTS)[number]['key'];

interface RecipientsResponse {
  count: number;
  segment: Segment;
}

interface SendResponse {
  sent: number;
  failed: number;
  skipped: number;
  test: boolean;
}

interface PickUser {
  id: string;
  username: string;
  email: string;
}

async function readError(res: Response): Promise<string> {
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  return body.error ?? 'Failed';
}

export function AdminMessages() {
  const [subject, setSubject] = React.useState('');
  const [html, setHtml] = React.useState('');
  const [segment, setSegment] = React.useState<Segment>('all');
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [sending, setSending] = React.useState(false);

  // Single-user picker state.
  const [userSearch, setUserSearch] = React.useState('');
  const [debouncedUserSearch, setDebouncedUserSearch] = React.useState('');
  const [selectedUser, setSelectedUser] = React.useState<PickUser | null>(null);

  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedUserSearch(userSearch), 250);
    return () => clearTimeout(t);
  }, [userSearch]);

  const isSingle = segment === 'user';
  const segmentLabel = SEGMENTS.find((s) => s.key === segment)?.label ?? 'All users';

  const recipients = useQuery<RecipientsResponse>({
    queryKey: ['admin-message-recipients', segment],
    enabled: !isSingle,
    queryFn: async () => {
      const res = await fetch(`/api/admin/messages/recipients?segment=${segment}`);
      if (!res.ok) throw new Error(await readError(res));
      return res.json();
    },
  });

  const usersQuery = useQuery<{ users: Array<{ id: string; username: string; email: string | null }> }>({
    queryKey: ['admin-message-users', debouncedUserSearch],
    enabled: isSingle && !selectedUser,
    queryFn: async () => {
      const res = await fetch(
        `/api/admin/users?search=${encodeURIComponent(debouncedUserSearch)}&page=1&pageSize=8`
      );
      if (!res.ok) throw new Error(await readError(res));
      return res.json();
    },
  });
  const userResults = (usersQuery.data?.users ?? []).filter((u): u is PickUser => Boolean(u.email));

  const recipientCount = isSingle ? (selectedUser ? 1 : 0) : (recipients.data?.count ?? 0);
  const canCompose = subject.trim().length > 0 && html.trim().length > 0;

  const send = async (test: boolean) => {
    setSending(true);
    try {
      const res = await fetch('/api/admin/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject,
          html,
          segment,
          email: isSingle ? selectedUser?.email : undefined,
          test,
        }),
      });
      if (!res.ok) throw new Error(await readError(res));
      const data = (await res.json()) as SendResponse;
      const summary = [
        `${data.sent} sent`,
        data.failed > 0 ? `${data.failed} failed` : null,
        data.skipped > 0 ? `${data.skipped} skipped (daily cap)` : null,
      ]
        .filter(Boolean)
        .join(', ');
      toast.success(test ? `Test email sent to you (${summary})` : `Broadcast complete: ${summary}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to send');
    } finally {
      setSending(false);
      setConfirmOpen(false);
    }
  };

  return (
    <PageLayout>
      <h1 className="mb-2 text-3xl font-bold">Admin</h1>
      <AdminNav />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Compose */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" /> Compose broadcast
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                value={subject}
                maxLength={200}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Subject line"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="body">Message body (HTML)</Label>
              <Textarea
                id="body"
                value={html}
                onChange={(e) => setHtml(e.target.value)}
                placeholder="<h1>Hello!</h1><p>Your World Cup update…</p>"
                className="min-h-64 font-mono text-xs"
              />
              <p className="text-muted-foreground text-xs">
                Raw HTML is sent as-is. The preview on the right renders it in a sandbox.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Recipients</Label>
              <RadioGroup value={segment} onValueChange={(v) => setSegment(v as Segment)}>
                {SEGMENTS.map((s) => (
                  <div key={s.key} className="flex items-center gap-2">
                    <RadioGroupItem value={s.key} id={`seg-${s.key}`} />
                    <Label htmlFor={`seg-${s.key}`} className="cursor-pointer font-normal">
                      {s.label}
                    </Label>
                  </div>
                ))}
              </RadioGroup>

              {/* Single-user picker */}
              {isSingle && (
                <div className="space-y-2 pt-1">
                  {selectedUser ? (
                    <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                      <span className="truncate">
                        <span className="font-medium">{selectedUser.username}</span>
                        <span className="text-muted-foreground"> · {selectedUser.email}</span>
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedUser(null)}
                      >
                        <X className="h-4 w-4" /> Change
                      </Button>
                    </div>
                  ) : (
                    <>
                      <Input
                        aria-label="Search users"
                        placeholder="Search users by name or email"
                        value={userSearch}
                        onChange={(e) => setUserSearch(e.target.value)}
                      />
                      <div className="max-h-48 overflow-auto rounded-md border">
                        {usersQuery.isLoading ? (
                          <p className="text-muted-foreground p-2 text-sm">Searching…</p>
                        ) : userResults.length === 0 ? (
                          <p className="text-muted-foreground p-2 text-sm">No users found.</p>
                        ) : (
                          userResults.map((u) => (
                            <button
                              key={u.id}
                              type="button"
                              onClick={() => {
                                setSelectedUser(u);
                                setUserSearch('');
                              }}
                              className="hover:bg-accent flex w-full flex-col items-start px-3 py-1.5 text-left text-sm"
                            >
                              <span className="font-medium">{u.username}</span>
                              <span className="text-muted-foreground text-xs">{u.email}</span>
                            </button>
                          ))
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}

              <p className="text-muted-foreground text-xs">
                {isSingle
                  ? selectedUser
                    ? `1 recipient — ${selectedUser.email}`
                    : 'Select a user above.'
                  : recipients.isLoading
                    ? 'Counting recipients…'
                    : recipients.isError
                      ? 'Could not load recipient count.'
                      : `${recipientCount} recipient${recipientCount === 1 ? '' : 's'}.`}
              </p>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                disabled={!canCompose || sending}
                onClick={() => send(true)}
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Send test to me
              </Button>
              <Button
                type="button"
                disabled={!canCompose || sending || recipientCount === 0}
                onClick={() => setConfirmOpen(true)}
              >
                <Send className="h-4 w-4" />
                Send to {recipientCount} recipient{recipientCount === 1 ? '' : 's'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Preview */}
        <Card>
          <CardHeader>
            <CardTitle>Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-background rounded-md border">
              <div className="text-muted-foreground border-b px-3 py-2 text-sm">
                <span className="font-medium">Subject:</span> {subject || '(none)'}
              </div>
              <iframe
                title="Email preview"
                sandbox=""
                srcDoc={html}
                className={cn('h-96 w-full rounded-b-md bg-white')}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={confirmOpen} onOpenChange={(open) => !sending && setConfirmOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send broadcast?</DialogTitle>
            <DialogDescription>
              {isSingle ? (
                <>
                  This will email &quot;{subject}&quot; to <strong>{selectedUser?.email}</strong>.
                  This cannot be undone.
                </>
              ) : (
                <>
                  This will email &quot;{subject}&quot; to {recipientCount} recipient
                  {recipientCount === 1 ? '' : 's'} in the <strong>{segmentLabel}</strong> group.
                  This cannot be undone.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" disabled={sending} onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button disabled={sending} onClick={() => send(false)}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Send now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
}
