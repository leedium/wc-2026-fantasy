import { redirect } from 'next/navigation';
import { getServerSupabase } from '@/lib/supabase/server';
import { ForgotPasswordForm } from './ForgotPasswordForm';
import { ROUTES } from '@/lib/constants';
import { PageLayout } from '@/components/layout/PageLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata = {
  title: 'Forgot password — soccer-pool 2026',
};

export default async function ForgotPasswordPage() {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect(ROUTES.predictions);

  return (
    <PageLayout>
      <div className="mx-auto max-w-md py-12">
        <Card>
          <CardHeader>
            <CardTitle>Forgot password</CardTitle>
            <CardDescription>
              Enter your username or email and we&apos;ll send you a reset link.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ForgotPasswordForm />
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  );
}
