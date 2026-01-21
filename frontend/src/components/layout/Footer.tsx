'use client';

import Link from 'next/link';
import { Separator } from '@/components/ui/separator';

const footerLinks = [
  { label: 'About', href: '/about' },
  { label: 'Rules', href: '/rules' },
  { label: 'Terms', href: '/terms' },
  { label: 'Privacy', href: '/privacy' },
];

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-border bg-background border-t">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-between">
          {/* Branding */}
          <div className="flex flex-col items-center sm:items-start">
            <span className="text-foreground text-lg font-semibold">WC2026 Prediction Game</span>
            <span className="text-muted-foreground text-sm">
              Decentralized predictions on Solana
            </span>
          </div>

          {/* Links */}
          <nav className="flex flex-wrap justify-center gap-4 sm:gap-6">
            {footerLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-muted-foreground hover:text-foreground text-sm transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <Separator className="my-6" />

        {/* Copyright */}
        <div className="text-muted-foreground text-center text-sm">
          &copy; {currentYear} World Cup 2026 Prediction Game. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
