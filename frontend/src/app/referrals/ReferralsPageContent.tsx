'use client';

import * as React from 'react';
import Link from 'next/link';
import { Copy, Gift, Share2 } from 'lucide-react';
import { toast } from 'sonner';

import { PageLayout } from '@/components/layout/PageLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useReferralStatus } from '@/hooks/useReferralStatus';
import { ROUTES } from '@/lib/constants';

/**
 * "Refer a friend" hub. Shows the user's shareable code + URL, three-stat
 * summary (pending invitees / credits available / credits used), and a
 * short explainer. The shareable URL is built at render time from
 * window.location.origin so dev/preview/prod each emit the correct host.
 */
export function ReferralsPageContent() {
  const { status, isLoading } = useReferralStatus();
  const [origin, setOrigin] = React.useState('');

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin);
    }
  }, []);

  const shareUrl = status.code && origin ? `${origin}${ROUTES.register}?ref=${status.code}` : '';

  const copy = async (value: string, label: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied to clipboard`);
    } catch {
      toast.error('Copy failed — long-press to select');
    }
  };

  const share = async () => {
    if (!shareUrl) return;
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: 'Join my WC2026 pool',
          text: 'Join my World Cup 2026 prediction pool — use my referral link:',
          url: shareUrl,
        });
        return;
      } catch {
        // user cancelled or share unavailable — fall through to copy
      }
    }
    copy(shareUrl, 'Share link');
  };

  // The qualified-but-not-yet-redeemed bucket (= availableCredits) is what
  // matters most. "Pending invitees" — referees who signed up but haven't
  // paid yet — is qualifiedTotal subtracted from referee count, but we
  // don't expose referee count for privacy, so present it as the gap
  // between qualified and total. We don't have a total here; fall back to
  // qualifiedTotal as the headline "referrals who paid" stat.
  return (
    <PageLayout>
      <div className="mx-auto max-w-2xl py-8">
        <div className="mb-6">
          <h1 className="mb-2 text-3xl font-bold">Refer a friend</h1>
          <p className="text-muted-foreground">
            Invite a friend with your referral link. When they pay for a prediction, you
            earn a <strong>free pick</strong> credit — redeem it on any unpaid bracket
            from the{' '}
            <Link href={ROUTES.predictions} className="text-primary hover:underline">
              predictions page
            </Link>
            .
          </p>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Share2 className="h-5 w-5" />
              Your referral link
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <Skeleton className="h-10 w-full" />
            ) : status.code ? (
              <>
                <div>
                  <label className="text-muted-foreground mb-1 block text-sm">
                    Code
                  </label>
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value={status.code}
                      className="font-mono uppercase tracking-widest"
                      onFocus={(e) => e.currentTarget.select()}
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => copy(status.code ?? '', 'Code')}
                      title="Copy code"
                    >
                      <Copy className="h-4 w-4" />
                      <span className="sr-only">Copy code</span>
                    </Button>
                  </div>
                </div>
                <div>
                  <label className="text-muted-foreground mb-1 block text-sm">
                    Share link
                  </label>
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value={shareUrl}
                      onFocus={(e) => e.currentTarget.select()}
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => copy(shareUrl, 'Share link')}
                      title="Copy link"
                    >
                      <Copy className="h-4 w-4" />
                      <span className="sr-only">Copy link</span>
                    </Button>
                    <Button onClick={share} className="gap-2">
                      <Share2 className="h-4 w-4" /> Share
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-muted-foreground text-sm">
                Your referral code isn&apos;t available right now. Try refreshing.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gift className="h-5 w-5" />
              Your referral activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="grid grid-cols-3 gap-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-4 text-center">
                <Stat
                  label="Free picks available"
                  value={status.availableCredits}
                  emphasis={status.availableCredits > 0}
                />
                <Stat label="Friends paid" value={status.qualifiedTotal} />
                <Stat label="Credits used" value={status.redeemedTotal} />
              </div>
            )}
            <p className="text-muted-foreground mt-4 text-xs">
              Credits unlock <em>only after</em> a referred friend&apos;s payment is
              confirmed by an admin. We don&apos;t show who used your code — only the
              counts.
            </p>
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  );
}

function Stat({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: number;
  emphasis?: boolean;
}) {
  return (
    <div className="rounded-md border p-3">
      <div
        className={
          emphasis
            ? 'text-2xl font-bold text-green-600 dark:text-green-400'
            : 'text-2xl font-bold'
        }
      >
        {value}
      </div>
      <div className="text-muted-foreground text-xs">{label}</div>
    </div>
  );
}
