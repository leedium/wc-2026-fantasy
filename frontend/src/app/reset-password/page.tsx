import { redirect } from 'next/navigation';
import { getServerSupabase } from '@/lib/supabase/server';
import { ResetPasswordForm } from './ResetPasswordForm';
import { PageLayout } from '@/components/layout/PageLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata = {
  title: 'Reset password — WC2026',
};

export default async function ResetPasswordPage() {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/forgot-password?error=expired');

  return (
    <PageLayout>
      <div className="mx-auto max-w-md py-12">
        <Card>
          <CardHeader>
            <CardTitle>Reset password</CardTitle>
            <CardDescription>Choose a new password for your account.</CardDescription>
          </CardHeader>
          <CardContent>
            <ResetPasswordForm />
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  );
}
