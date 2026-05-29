'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { CircleDollarSign } from 'lucide-react';

import { cn } from '@/lib/utils';
import { CHARITIES, ROUTES } from '@/lib/constants';
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

// Per-charity shares can be fractional when the entry count is odd (the $5/entry
// charity portion splits to $2.50). Show cents only when present ($17.50) so the
// shares sum back to the total instead of each rounding up; whole shares stay clean
// ($103) via the pot formatter.
const CHARITY_CENTS_FORMATTER = new Intl.NumberFormat('en-CA', {
  style: 'currency',
  currency: 'CAD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const formatCharityShare = (value: number) =>
  (Number.isInteger(value) ? POT_FORMATTER : CHARITY_CENTS_FORMATTER).format(value);

// Tournament-facing pages where pool stats are contextually relevant.
// Admin / account / auth / marketing pages stay clean.
export const POOL_STATS_VISIBLE_PATHS: readonly string[] = [
  ROUTES.home,
  ROUTES.predictions,
  ROUTES.leaderboard,
  ROUTES.rules,
  ROUTES.charities,
  ROUTES.rewards,
  ROUTES.referrals,
];

export function isPoolStatsVisiblePath(pathname: string): boolean {
  return POOL_STATS_VISIBLE_PATHS.some((path) =>
    path === ROUTES.home ? pathname === path : pathname === path || pathname.startsWith(`${path}/`)
  );
}

/**
 * Slim sticky strip directly under the main Header showing the live pot total
 * and the charity-raised total, broken down evenly across the supported
 * charities. Shares the ['tournament'] React Query cache key with
 * HomePageContent so no extra request is issued when both mount on /.
 */
export function PoolStatsBar({ className }: { className?: string }) {
  const pathname = usePathname();
  const { user, loading } = useAuthContext();
  const query = useQuery<TournamentSlice>({
    queryKey: ['tournament'],
    enabled: !loading && !!user && isPoolStatsVisiblePath(pathname),
    queryFn: async () => {
      const res = await fetch('/api/tournament');
      if (!res.ok) throw new Error('Failed to fetch tournament');
      return res.json();
    },
  });

  if (!isPoolStatsVisiblePath(pathname)) return null;
  if (!user || !query.data) return null;

  const pot = POT_FORMATTER.format(query.data.potTotalCAD);
  const perCharity = formatCharityShare(query.data.charityTotalCAD / CHARITIES.length);

  return (
    <div
      role="status"
      aria-label={`Pot total ${pot}; charity total: ${CHARITIES.map(
        (c) => `${c.name} ${perCharity}`
      ).join(', ')}`}
      className={cn(
        'border-border bg-muted/40 supports-[backdrop-filter]:bg-muted/30 sticky top-16 z-40 w-full border-b backdrop-blur',
        className
      )}
    >
      <div className="text-muted-foreground mx-auto flex max-w-7xl items-center justify-end gap-3 px-4 py-1.5 text-xs sm:gap-6 sm:px-6 sm:text-sm lg:px-8">
        <span className="flex items-center gap-1.5">
          <CircleDollarSign className="h-4 w-4" aria-hidden />
          <span className="text-foreground font-medium">
            <span className="hidden sm:inline">Pot </span>
            {pot}
          </span>
        </span>
        <span className="flex items-center gap-2 sm:gap-3">
          <span className="text-foreground hidden font-medium sm:inline">Charity Total:</span>
          {CHARITIES.map((charity) => (
            <Link
              key={charity.slug}
              href={`${ROUTES.charities}/${charity.slug}`}
              aria-label={`${charity.name}: ${perCharity} for charity`}
              className="hover:text-foreground flex items-center gap-1.5"
            >
              <span className="border-border flex h-5 items-center justify-center rounded border bg-white px-1">
                <Image
                  src={charity.logo}
                  alt={`${charity.name} logo`}
                  width={48}
                  height={20}
                  className="h-3.5 w-auto max-w-[72px] object-contain sm:h-4"
                />
              </span>
              <span className="text-foreground font-medium">{perCharity}</span>
            </Link>
          ))}
        </span>
      </div>
    </div>
  );
}
