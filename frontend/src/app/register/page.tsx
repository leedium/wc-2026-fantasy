import { redirect } from 'next/navigation';
import { getServerSupabase } from '@/lib/supabase/server';
import { RegisterForm } from './RegisterForm';
import { REFERRAL_CODE_REGEX, ROUTES } from '@/lib/constants';
import { PageLayout } from '@/components/layout/PageLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata = {
  title: 'Sign up — WC2026',
};

// Next.js 16 — searchParams is a Promise.
export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string | string[] }>;
}) {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect(ROUTES.predictions);

  const params = await searchParams;
  const rawRef = Array.isArray(params.ref) ? params.ref[0] : params.ref;
  // Normalize and apply a light client-side format check so we don't echo
  // arbitrary query strings into the form. The server RPC is the real check.
  const normalized = rawRef?.trim().toUpperCase();
  const initialReferralCode =
    normalized && REFERRAL_CODE_REGEX.test(normalized) ? normalized : undefined;

  return (
    <PageLayout>
      <div className="mx-auto max-w-md py-12">
        <Card>
          <CardHeader>
            <CardTitle>Create an account</CardTitle>
            <CardDescription>Pick a username, enter your email and a password.</CardDescription>
          </CardHeader>
          <CardContent>
            <RegisterForm initialReferralCode={initialReferralCode} />
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  );
}
