import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

import { QueryProvider } from '@/providers/QueryProvider';
import { ThemeProvider } from '@/providers/ThemeProvider';
import { AuthProvider } from '@/providers/AuthProvider';
import { Toaster } from '@/components/ui/sonner';
import { getServerSupabase } from '@/lib/supabase/server';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'World Cup 2026 Prediction Game',
  description:
    'Submit your bracket predictions for the FIFA World Cup 2026 and compete on the leaderboard.',
  openGraph: {
    title: 'World Cup 2026 Prediction Game',
    description:
      'Submit your bracket predictions for the FIFA World Cup 2026 and compete on the leaderboard.',
    type: 'website',
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let profile = null;
  if (user) {
    const { data } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, is_admin, is_super_admin')
      .eq('id', user.id)
      .maybeSingle();
    profile = data
      ? {
          id: data.id,
          username: data.username,
          displayName: data.display_name,
          avatarUrl: data.avatar_url,
          isAdmin: data.is_admin,
          isSuperAdmin: data.is_super_admin,
        }
      : null;
  }

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <ThemeProvider>
          <QueryProvider>
            <AuthProvider initialUser={user} initialProfile={profile}>
              {children}
              <Toaster />
            </AuthProvider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
