import { redirect } from 'next/navigation';
import { getServerSupabase } from '@/lib/supabase/server';
import { LoginForm } from './LoginForm';
import { ROUTES } from '@/lib/constants';
import { PageLayout } from '@/components/layout/PageLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata = {
  title: 'Sign in — soccer-pool 2026',
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect(ROUTES.predictions);

  const { next } = await searchParams;

  return (
    <PageLayout>
      <div className="mx-auto max-w-md py-12">
        <Card>
          <CardHeader>
            <CardTitle>Sign in</CardTitle>
            <CardDescription>
              Welcome back. Enter your email and password to continue.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LoginForm redirectTo={next || ROUTES.predictions} />
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  );
}
