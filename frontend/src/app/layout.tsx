import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

import { QueryProvider } from '@/providers/QueryProvider';
import { WalletProvider } from '@/providers/WalletProvider';
import { ThemeProvider } from '@/providers/ThemeProvider';
import { Toaster } from '@/components/ui/sonner';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'World Cup 2026 Prediction Game',
  description:
    'Decentralized prediction game on Solana. Submit your bracket predictions for the FIFA World Cup 2026 and compete for the prize pool.',
  openGraph: {
    title: 'World Cup 2026 Prediction Game',
    description:
      'Decentralized prediction game on Solana. Submit your bracket predictions for the FIFA World Cup 2026 and compete for the prize pool.',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <ThemeProvider>
          <QueryProvider>
            <WalletProvider>
              {children}
              <Toaster />
            </WalletProvider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
