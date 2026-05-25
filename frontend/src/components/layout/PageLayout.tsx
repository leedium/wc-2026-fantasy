'use client';

import { Header } from './Header';
import { Footer } from './Footer';
import { LockStatusBanner } from './LockStatusBanner';
import { PoolStatsBar } from './PoolStatsBar';

interface PageLayoutProps {
  children: React.ReactNode;
}

export function PageLayout({ children }: PageLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col">
      <LockStatusBanner />
      <Header />
      <PoolStatsBar />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">{children}</main>
      <Footer />
    </div>
  );
}
