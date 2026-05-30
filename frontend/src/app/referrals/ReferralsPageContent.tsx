'use client';

import * as React from 'react';
import Link from 'next/link';
import { Copy, Share2 } from 'lucide-react';
import { toast } from 'sonner';

import { PageLayout } from '@/components/layout/PageLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useRewardsStatus } from '@/hooks/useRewardsStatus';
import { ROUTES } from '@/lib/constants';
import { ANALYTICS_EVENTS, trackEvent } from '@/lib/analytics';

/**
 * "Refer a friend" share page. Single job: show the user's code + share
 * URL with one-tap copy/share. Credit counts and history live on /rewards
 * (linked at the bottom).
 */
export function ReferralsPageContent() {
  const { status, isLoading } = useRewardsStatus();
  const [origin, setOrigin] = React.useState('');

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin);
    }
  }, []);

  const shareUrl =
    status.referralCode && origin
      ? `${origin}${ROUTES.register}?ref=${status.referralCode}`
      : '';

  const copy = async (value: string, label: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied to clipboard`);
      trackEvent(ANALYTICS_EVENTS.referralShared, {
        method: label === 'Code' ? 'code' : 'link',
      });
    } catch {
      toast.error('Copy failed — long-press to select');
    }
  };

  const share = async () => {
    if (!shareUrl) return;
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: 'Join my soccer-pool 2026',
          text: 'Join my World Cup 2026 prediction pool — use my referral link:',
          url: shareUrl,
        });
        trackEvent(ANALYTICS_EVENTS.referralShared, { method: 'native' });
        return;
      } catch {
        // user cancelled or share unavailable — fall through to copy
      }
    }
    copy(shareUrl, 'Share link');
  };

  return (
    <PageLayout>
      <div className="mx-auto max-w-2xl py-8">
        <div className="mb-6">
          <h1 className="mb-2 text-3xl font-bold">Refer a friend</h1>
          <p className="text-muted-foreground">
            Share your referral link. For every <strong>4 friends</strong> who
            sign up and pay for a prediction, you earn a <strong>free pick</strong>.
            Track your credits on the{' '}
            <Link href={ROUTES.rewards} className="text-primary hover:underline">
              rewards page
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
            ) : status.referralCode ? (
              <>
                <div>
                  <label className="text-muted-foreground mb-1 block text-sm">
                    Code
                  </label>
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value={status.referralCode}
                      className="font-mono uppercase tracking-widest"
                      onFocus={(e) => e.currentTarget.select()}
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => copy(status.referralCode ?? '', 'Code')}
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

      </div>
    </PageLayout>
  );
}
