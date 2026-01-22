'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { Menu } from 'lucide-react';

// Dynamic import to avoid SSR hydration mismatch (wallet state differs server vs client)
const WalletMultiButton = dynamic(
  () => import('@solana/wallet-adapter-react-ui').then((mod) => mod.WalletMultiButton),
  { ssr: false }
);

import { cn } from '@/lib/utils';
import { ROUTES } from '@/lib/constants';
import { ThemeToggle } from '@/components/shared/ThemeToggle';
import {
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
  NavigationMenuLink,
  navigationMenuTriggerStyle,
} from '@/components/ui/navigation-menu';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';

const navLinks = [
  { label: 'Home', href: ROUTES.home },
  { label: 'Predictions', href: ROUTES.predictions },
  { label: 'Leaderboard', href: ROUTES.leaderboard },
  { label: 'Claims', href: ROUTES.claims },
];

export function Header() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === ROUTES.home) {
      return pathname === href;
    }
    return pathname.startsWith(href);
  };

  return (
    <header className="border-border bg-background/95 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50 w-full border-b backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo/Brand */}
        <Link href={ROUTES.home} className="flex items-center space-x-2">
          <span className="text-foreground text-xl font-bold">WC2026</span>
        </Link>

        {/* Desktop Navigation */}
        <NavigationMenu className="hidden md:flex">
          <NavigationMenuList>
            {navLinks.map((link) => (
              <NavigationMenuItem key={link.href}>
                <NavigationMenuLink asChild>
                  <Link
                    href={link.href}
                    className={cn(
                      navigationMenuTriggerStyle(),
                      isActive(link.href) && 'bg-accent text-accent-foreground font-semibold'
                    )}
                  >
                    {link.label}
                  </Link>
                </NavigationMenuLink>
              </NavigationMenuItem>
            ))}
          </NavigationMenuList>
        </NavigationMenu>

        {/* Desktop Theme Toggle & Wallet Button */}
        <div className="hidden items-center gap-4 md:flex">
          <ThemeToggle />
          <WalletMultiButton />
        </div>

        {/* Mobile Navigation */}
        <div className="flex items-center gap-2 md:hidden">
          <WalletMultiButton />
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Open menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right">
              <SheetHeader>
                <SheetTitle>Navigation</SheetTitle>
              </SheetHeader>
              <nav className="mt-6 flex flex-col space-y-4">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={cn(
                      'hover:text-foreground rounded-md px-3 py-2 text-lg transition-colors',
                      isActive(link.href)
                        ? 'bg-accent text-accent-foreground font-semibold'
                        : 'text-muted-foreground'
                    )}
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>
              <div className="mt-6 flex items-center gap-2 border-t pt-6">
                <span className="text-muted-foreground text-sm">Theme:</span>
                <ThemeToggle />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
