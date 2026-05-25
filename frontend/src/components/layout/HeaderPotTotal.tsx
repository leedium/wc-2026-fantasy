'use client';

import { useQuery } from '@tanstack/react-query';
import { CircleDollarSign, HeartHandshake } from 'lucide-react';

import { useAuthContext } from '@/providers/AuthProvider';

interface TournamentSlice {
  potTotalCAD: number;
  charityTotalCAD: number;
}

const POT_FORMATTER = new Intl.NumberFormat('en-CA', {
  style: 'currency',
  currency: 'CAD',
  maximumFractionDigits: 0,
});

/**
 * Small inline badge showing the live pot total + charity-raised total in
 * the Header. Visible only to authenticated users. Shares the ['tournament']
 * React Query cache key with HomePageContent, so it doesn't trigger an
 * extra request when both are mounted on /.
 */
export function HeaderPotTotal({
  className,
}: {
  className?: string;
}) {
  const { user, loading } = useAuthContext();
  const query = useQuery<TournamentSlice>({
    queryKey: ['tournament'],
    enabled: !loading && !!user,
    queryFn: async () => {
      const res = await fetch('/api/tournament');
      if (!res.ok) throw new Error('Failed to fetch tournament');
      return res.json();
    },
  });

  if (!user || !query.data) return null;

  const pot = POT_FORMATTER.format(query.data.potTotalCAD);
  const charity = POT_FORMATTER.format(query.data.charityTotalCAD);

  return (
    <div
      className={`text-muted-foreground flex items-center gap-3 text-sm font-medium ${className ?? ''}`}
      aria-label={`Pot total ${pot}, raised for charity ${charity}`}
    >
      <span className="flex items-center gap-1.5">
        <CircleDollarSign className="h-4 w-4" aria-hidden />
        <span className="text-foreground">Pot {pot}</span>
      </span>
      <span className="flex items-center gap-1.5">
        <HeartHandshake className="h-4 w-4" aria-hidden />
        <span className="text-foreground">Charity {charity}</span>
      </span>
    </div>
  );
}
