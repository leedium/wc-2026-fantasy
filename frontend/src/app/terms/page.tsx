import type { Metadata } from 'next';
import Link from 'next/link';

import { PageLayout } from '@/components/layout/PageLayout';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { ROUTES } from '@/lib/constants';

export const metadata: Metadata = {
  title: 'Terms of Use | World Cup 2026',
  description:
    'Terms of Use for the World Cup 2026 Prediction Game — accounts, acceptable use, predictions, and disclaimers.',
};

export default function TermsPage() {
  return (
    <PageLayout>
      <article className="mx-auto max-w-3xl py-12">
        <Badge variant="outline" className="mb-4">
          Legal
        </Badge>
        <h1 className="mb-2 text-3xl font-bold tracking-tight md:text-4xl">Terms of Use</h1>
        <p className="text-muted-foreground mb-8 text-sm">Last updated: 2026-05-14</p>

        <div className="space-y-8 text-sm leading-relaxed">
          <section>
            <h2 className="text-foreground mb-3 text-xl font-semibold">1. Acceptance of terms</h2>
            <p className="text-muted-foreground">
              By creating an account or otherwise using the World Cup 2026 Prediction Game (the
              &quot;Service&quot;), you agree to these Terms of Use. If you do not agree, do
              not use the Service.
            </p>
          </section>

          <Separator />

          <section>
            <h2 className="text-foreground mb-3 text-xl font-semibold">
              2. Eligibility and accounts
            </h2>
            <p className="text-muted-foreground mb-3">
              You must be old enough under the laws of your jurisdiction to enter into a
              binding contract in order to use the Service.
              {/* TODO: confirm minimum-age threshold with legal review before launch */}
            </p>
            <p className="text-muted-foreground mb-3">
              You agree to provide accurate information when registering, to keep your
              credentials confidential, and to be responsible for activity that occurs under
              your account. One account per person.
            </p>
            <p className="text-muted-foreground">
              We may suspend or close accounts that appear to be duplicates, automated, or
              used to abuse the Service.
            </p>
          </section>

          <Separator />

          <section>
            <h2 className="text-foreground mb-3 text-xl font-semibold">3. Acceptable use</h2>
            <p className="text-muted-foreground mb-3">You agree not to:</p>
            <ul className="text-muted-foreground ml-6 list-disc space-y-2">
              <li>Scrape, crawl, or otherwise harvest data from the Service automatically.</li>
              <li>
                Attempt to disrupt the leaderboard, scoring, or any other Service feature.
              </li>
              <li>
                Probe, scan, or attempt to gain unauthorized access to accounts, systems, or
                data.
              </li>
              <li>Harass, threaten, or abuse other users.</li>
              <li>Use the Service to do anything illegal under applicable law.</li>
            </ul>
          </section>

          <Separator />

          <section>
            <h2 className="text-foreground mb-3 text-xl font-semibold">
              4. Predictions and scoring
            </h2>
            <p className="text-muted-foreground mb-3">
              Predictions, scoring, and leaderboard eligibility are governed by the rules
              published at <Link href={ROUTES.rules} className="underline">/rules</Link>. We
              may amend those rules before the tournament-wide lock time; once the lock time
              passes, the rules in force at that moment apply to scoring for the tournament.
            </p>
            <p className="text-muted-foreground">
              Match results, group standings, and other tournament outcomes are entered by
              authorized administrators. We use reasonable care, but we make no guarantee
              that any entry will be made within a particular time window.
            </p>
          </section>

          <Separator />

          <section>
            <h2 className="text-foreground mb-3 text-xl font-semibold">5. No affiliation</h2>
            <p className="text-muted-foreground">
              This is an independent, fan-run prediction game. It is not affiliated with,
              endorsed by, or sponsored by FIFA, any participating football association, any
              broadcaster, or any tournament sponsor. All team names, country names, and
              tournament references are used for identification only.
            </p>
          </section>

          <Separator />

          <section>
            <h2 className="text-foreground mb-3 text-xl font-semibold">6. No warranty</h2>
            <p className="text-muted-foreground">
              The Service is provided &quot;as is&quot; and &quot;as available&quot;, without
              warranties of any kind, express or implied. We do not warrant that the Service
              will be uninterrupted, error-free, or available at any particular time, or that
              scoring will be free of errors.
            </p>
          </section>

          <Separator />

          <section>
            <h2 className="text-foreground mb-3 text-xl font-semibold">
              7. Limitation of liability
            </h2>
            <p className="text-muted-foreground">
              To the maximum extent permitted by law, in no event will the operators of the
              Service be liable for any indirect, incidental, special, consequential, or
              punitive damages, or any loss of data or profits, arising out of or in
              connection with your use of the Service.
            </p>
          </section>

          <Separator />

          <section>
            <h2 className="text-foreground mb-3 text-xl font-semibold">8. Changes to the terms</h2>
            <p className="text-muted-foreground">
              We may update these Terms of Use from time to time. Material changes will be
              indicated by updating the &quot;Last updated&quot; date above. Your continued
              use of the Service after a change takes effect constitutes acceptance of the
              new terms.
            </p>
          </section>

          <Separator />

          <section>
            <h2 className="text-foreground mb-3 text-xl font-semibold">9. Governing law</h2>
            <p className="text-muted-foreground">
              These terms are governed by the laws of [Jurisdiction TBD], without regard to
              its conflict-of-law principles.
              {/* TODO: set governing-law jurisdiction with legal review before launch */}
            </p>
          </section>

          <Separator />

          <section>
            <h2 className="text-foreground mb-3 text-xl font-semibold">10. Contact</h2>
            <p className="text-muted-foreground">
              Questions about these terms? Contact us at [contact email TBD].
              {/* TODO: replace with a real contact email before launch */}
            </p>
          </section>
        </div>
      </article>
    </PageLayout>
  );
}
