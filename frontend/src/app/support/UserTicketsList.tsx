'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  SUPPORT_TICKET_SUBJECT_LABELS,
  type SupportTicketSubject,
} from '@/lib/constants';

interface UserTicket {
  id: string;
  subject: SupportTicketSubject;
  title: string;
  description: string;
  created_at: string;
}

interface TicketsResponse {
  tickets: UserTicket[];
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function UserTicketsList() {
  const query = useQuery<TicketsResponse>({
    queryKey: ['support', 'mine'],
    queryFn: async () => {
      const res = await fetch('/api/support');
      if (!res.ok) throw new Error('Failed to load tickets');
      return res.json();
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your tickets</CardTitle>
      </CardHeader>
      <CardContent>
        {query.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : query.isError ? (
          <p className="text-destructive text-sm">Couldn&apos;t load your tickets.</p>
        ) : !query.data?.tickets.length ? (
          <p className="text-muted-foreground text-sm">
            You haven&apos;t submitted any tickets yet.
          </p>
        ) : (
          <ul className="space-y-3">
            {query.data.tickets.map((t) => (
              <UserTicketItem key={t.id} ticket={t} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function UserTicketItem({ ticket }: { ticket: UserTicket }) {
  const [expanded, setExpanded] = React.useState(false);
  return (
    <li className="border-border rounded-md border p-3">
      <div className="mb-1 flex items-center justify-between gap-2">
        <Badge variant="outline">{SUPPORT_TICKET_SUBJECT_LABELS[ticket.subject]}</Badge>
        <time className="text-muted-foreground text-xs" dateTime={ticket.created_at}>
          {formatDate(ticket.created_at)}
        </time>
      </div>
      <p className="font-medium text-sm">{ticket.title}</p>
      <p
        className={
          expanded
            ? 'text-muted-foreground mt-1 text-sm whitespace-pre-wrap'
            : 'text-muted-foreground mt-1 line-clamp-2 text-sm'
        }
      >
        {ticket.description}
      </p>
      {ticket.description.length > 120 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-primary mt-1 text-xs hover:underline"
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </li>
  );
}
