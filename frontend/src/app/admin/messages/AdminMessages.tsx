'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, Mail, Send } from 'lucide-react';

import { PageLayout } from '@/components/layout/PageLayout';
import { AdminNav } from '@/components/admin/AdminNav';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

type Scope = 'all' | 'paid';

interface RecipientsResponse {
  count: number;
  paidOnly: boolean;
}

interface SendResponse {
  sent: number;
  failed: number;
  skipped: number;
  test: boolean;
}

async function readError(res: Response): Promise<string> {
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  return body.error ?? 'Failed';
}

export function AdminMessages() {
  const [subject, setSubject] = React.useState('');
  const [html, setHtml] = React.useState('');
  const [scope, setScope] = React.useState<Scope>('all');
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [sending, setSending] = React.useState(false);

  const paidOnly = scope === 'paid';

  const recipients = useQuery<RecipientsResponse>({
    queryKey: ['admin-message-recipients', paidOnly],
    queryFn: async () => {
      const res = await fetch(`/api/admin/messages/recipients?paidOnly=${paidOnly}`);
      if (!res.ok) throw new Error(await readError(res));
      return res.json();
    },
  });

  const recipientCount = recipients.data?.count ?? 0;
  const canCompose = subject.trim().length > 0 && html.trim().length > 0;

  const send = async (test: boolean) => {
    setSending(true);
    try {
      const res = await fetch('/api/admin/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, html, paidOnly, test }),
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

            <div className="space-y-1.5">
              <Label>Recipients</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={scope === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setScope('all')}
                >
                  All users
                </Button>
                <Button
                  type="button"
                  variant={scope === 'paid' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setScope('paid')}
                >
                  Paid users only
                </Button>
              </div>
              <p className="text-muted-foreground text-xs">
                {recipients.isLoading
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
              This will email &quot;{subject}&quot; to {recipientCount}{' '}
              {scope === 'paid' ? 'paid ' : ''}recipient{recipientCount === 1 ? '' : 's'}. This
              cannot be undone.
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
