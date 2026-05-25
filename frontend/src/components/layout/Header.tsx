'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu } from 'lucide-react';

import { cn } from '@/lib/utils';
import { ROUTES } from '@/lib/constants';
import { AuthMenu } from '@/components/layout/AuthMenu';
import { HeaderPotTotal } from '@/components/layout/HeaderPotTotal';
import { ThemeToggle } from '@/components/shared/ThemeToggle';
import { useAuthContext } from '@/providers/AuthProvider';
import { useMounted } from '@/hooks/useMounted';
import {
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
  NavigationMenuLink,
  navigationMenuTriggerStyle,
} from '@/components/ui/navigation-menu';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';

const baseNavLinks = [
  { label: 'Home', href: ROUTES.home },
  { label: 'Predictions', href: ROUTES.predictions },
  { label: 'Leaderboard', href: ROUTES.leaderboard },
  { label: 'Rules & Scoring', href: ROUTES.rules },
  { label: 'About', href: ROUTES.about },
  { label: 'Charities', href: ROUTES.charities },
];

export function Header() {
  const pathname = usePathname();
  const { profile } = useAuthContext();
  const mounted = useMounted();
  const navLinks = profile?.isAdmin
    ? [...baseNavLinks, { label: 'Admin', href: ROUTES.admin }]
    : baseNavLinks;

  const isActive = (href: string) => {
    if (href === ROUTES.home) {
      return pathname === href;
    }
    return pathname.startsWith(href);
  };

  return (
    <header className="border-border bg-background/95 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50 w-full border-b backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href={ROUTES.home} className="flex items-center space-x-2">
          <span className="text-foreground text-xl font-bold">soccer-pool 2026</span>
        </Link>

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

        <div className="hidden items-center gap-4 md:flex">
          <HeaderPotTotal />
          <ThemeToggle />
          <AuthMenu />
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <AuthMenu />
          {/* Same hydration-mismatch dodge as AuthMenu: defer the Radix
              Sheet until after mount so its useId-driven aria-controls
              doesn't drift between SSR and client. */}
          {mounted ? (
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
                <HeaderPotTotal className="mt-4" />
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
                <div className="mt-6 flex flex-col gap-4 border-t pt-6">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-sm">Theme:</span>
                    <ThemeToggle />
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          ) : (
            <Button variant="ghost" size="icon" aria-label="Open menu" disabled>
              <Menu className="h-5 w-5" />
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
