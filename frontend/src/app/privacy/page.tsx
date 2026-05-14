import type { Metadata } from 'next';
import Link from 'next/link';

import { PageLayout } from '@/components/layout/PageLayout';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { ROUTES } from '@/lib/constants';

export const metadata: Metadata = {
  title: 'Privacy Policy | World Cup 2026',
  description:
    'Privacy Policy for the World Cup 2026 Prediction Game — what data we collect, how it is used, and your rights.',
};

export default function PrivacyPage() {
  return (
    <PageLayout>
      <article className="mx-auto max-w-3xl py-12">
        <Badge variant="outline" className="mb-4">
          Legal
        </Badge>
        <h1 className="mb-2 text-3xl font-bold tracking-tight md:text-4xl">Privacy Policy</h1>
        <p className="text-muted-foreground mb-8 text-sm">Last updated: 2026-05-14</p>

        <div className="space-y-8 text-sm leading-relaxed">
          <section>
            <h2 className="text-foreground mb-3 text-xl font-semibold">Overview</h2>
            <p className="text-muted-foreground">
              This policy explains what information the World Cup 2026 Prediction Game
              collects about you, how we use it, and the choices you have. We try to keep
              the answer short: we collect what we need to run the game, and nothing we
              don&apos;t.
            </p>
          </section>

          <Separator />

          <section>
            <h2 className="text-foreground mb-3 text-xl font-semibold">What we collect</h2>
            <ul className="text-muted-foreground ml-6 list-disc space-y-2">
              <li>
                <span className="text-foreground font-semibold">Account information.</span>{' '}
                The email and password you use to register, plus a username (auto-generated
                at signup; you can change it from your account page) and an optional display
                name and avatar URL.
              </li>
              <li>
                <span className="text-foreground font-semibold">Your predictions.</span>{' '}
                Group-stage picks, knockout bracket picks, tiebreaker, prediction names, and
                related metadata such as when each prediction was last saved.
              </li>
              <li>
                <span className="text-foreground font-semibold">Payment status.</span>{' '}
                Whether and when an admin marked a prediction as paid for leaderboard
                eligibility. We do not collect or store payment-card details on this site.
              </li>
              <li>
                <span className="text-foreground font-semibold">Basic request metadata.</span>{' '}
                IP address, user agent, and similar information needed to deliver the site
                and apply abuse / rate-limiting protections at the network edge.
              </li>
            </ul>
          </section>

          <Separator />

          <section>
            <h2 className="text-foreground mb-3 text-xl font-semibold">How we use it</h2>
            <ul className="text-muted-foreground ml-6 list-disc space-y-2">
              <li>To authenticate you and keep your session active.</li>
              <li>To save, score, and display your predictions.</li>
              <li>
                To display your username, prediction name, and points on the public
                leaderboard once a prediction is marked paid and the tournament locks. (See{' '}
                <Link href={ROUTES.rules} className="underline">
                  rules
                </Link>{' '}
                for the scoring details.)
              </li>
              <li>
                To protect the Service from abuse — including rate limiting, request
                filtering, and incident investigation.
              </li>
            </ul>
            <p className="text-muted-foreground mt-3">
              We do not sell your personal information, and we do not use it for advertising.
            </p>
          </section>

          <Separator />

          <section>
            <h2 className="text-foreground mb-3 text-xl font-semibold">
              Service providers we use
            </h2>
            <ul className="text-muted-foreground ml-6 list-disc space-y-2">
              <li>
                <span className="text-foreground font-semibold">Supabase</span> — hosts our
                Postgres database and handles authentication (email + password) on our
                behalf.
              </li>
              <li>
                <span className="text-foreground font-semibold">Cloudflare</span> — delivers
                the site, terminates TLS, and applies network-level rate limiting and bot
                protection.
              </li>
            </ul>
            <p className="text-muted-foreground mt-3">
              These providers process data on our behalf under their own privacy and
              security commitments. Your data may be processed in regions outside your
              own.
            </p>
          </section>

          <Separator />

          <section>
            <h2 className="text-foreground mb-3 text-xl font-semibold">Cookies</h2>
            <p className="text-muted-foreground mb-3">
              We use a small number of strictly-necessary cookies to keep you signed in and
              to remember a few UI preferences (such as your theme). We do not use
              third-party advertising cookies or cross-site trackers.
            </p>
            <p className="text-muted-foreground">
              You can clear these cookies at any time in your browser settings; doing so will
              sign you out.
            </p>
          </section>

          <Separator />

          <section>
            <h2 className="text-foreground mb-3 text-xl font-semibold">What is public</h2>
            <p className="text-muted-foreground">
              Once your prediction is marked paid and the tournament locks, your username,
              prediction name, and points become visible on the public leaderboard. Your
              email address, password, and unpaid predictions are never shown publicly.
            </p>
          </section>

          <Separator />

          <section>
            <h2 className="text-foreground mb-3 text-xl font-semibold">Your rights</h2>
            <p className="text-muted-foreground mb-3">
              You can ask us to access, correct, export, or delete the personal data we hold
              about you by contacting us using the address below. We&apos;ll respond within
              a reasonable time and may need to verify your identity first.
            </p>
            <p className="text-muted-foreground">
              Depending on where you live, you may have additional rights under laws such as
              the GDPR or your local equivalent.
              {/* TODO: confirm jurisdiction-specific language with legal review */}
            </p>
          </section>

          <Separator />

          <section>
            <h2 className="text-foreground mb-3 text-xl font-semibold">Children</h2>
            <p className="text-muted-foreground">
              The Service is not directed at children. If we learn we have collected
              personal data from a child below the applicable age in their jurisdiction, we
              will delete it.
              {/* TODO: confirm minimum-age threshold and any region-specific notices */}
            </p>
          </section>

          <Separator />

          <section>
            <h2 className="text-foreground mb-3 text-xl font-semibold">Changes to this policy</h2>
            <p className="text-muted-foreground">
              We may update this policy from time to time. Material changes will be
              reflected by updating the &quot;Last updated&quot; date above. Significant
              changes may be announced in the Service.
            </p>
          </section>

          <Separator />

          <section>
            <h2 className="text-foreground mb-3 text-xl font-semibold">Contact</h2>
            <p className="text-muted-foreground">
              Privacy questions or requests? Contact us at [contact email TBD].
              {/* TODO: replace with a real contact email before launch */}
            </p>
          </section>
        </div>
      </article>
    </PageLayout>
  );
}
