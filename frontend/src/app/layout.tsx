import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { GoogleTagManager } from '@next/third-parties/google';
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
  robots: { index: false, follow: false },
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

  // GTM loads only in production builds AND when a container ID is configured,
  // so local/dev traffic is never tracked. Loaded with the afterInteractive
  // strategy by @next/third-parties — does not block first paint.
  const gtmId = process.env.NEXT_PUBLIC_GTM_ID;
  const gtmEnabled = process.env.NODE_ENV === 'production';

  return (
    <html lang="en" className="dark" style={{ colorScheme: 'dark' }} suppressHydrationWarning>
      {gtmEnabled && gtmId && <GoogleTagManager gtmId={gtmId} />}
      <body className={`${inter.variable} font-sans antialiased`}>
        {/*
          Turbopack instruments functions with an esbuild-style `__name` keep-names helper that
          only exists inside its module runtime. next-themes serializes its anti-flash theme
          function via `Function.prototype.toString()` and injects it as an inline <script>, which
          then references `__name` in the browser global scope where it is undefined — throwing
          "ReferenceError: __name is not defined" on every page load. This no-op shim defines it
          globally and runs before the next-themes script (injected right after, as the next child
          of <body>).
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: 'window.__name||(window.__name=function(t){return t})',
          }}
        />
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
