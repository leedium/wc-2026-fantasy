import { redirect } from 'next/navigation';
import { getServerSupabase } from '@/lib/supabase/server';
import { RegisterForm } from './RegisterForm';
import { ROUTES } from '@/lib/constants';
import { PageLayout } from '@/components/layout/PageLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata = {
  title: 'Sign up — WC2026',
};

export default async function RegisterPage() {
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
            <CardTitle>Create an account</CardTitle>
            <CardDescription>Pick a username, enter your email and a password.</CardDescription>
          </CardHeader>
          <CardContent>
            <RegisterForm />
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  );
}
