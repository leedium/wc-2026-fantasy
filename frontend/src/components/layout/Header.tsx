'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDown, Menu } from 'lucide-react';

import { cn } from '@/lib/utils';
import { ROUTES } from '@/lib/constants';
import { AuthMenu } from '@/components/layout/AuthMenu';
import { ThemeToggle } from '@/components/shared/ThemeToggle';
import { useMounted } from '@/hooks/useMounted';
import {
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
  NavigationMenuLink,
  navigationMenuTriggerStyle,
} from '@/components/ui/navigation-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';

/**
 * Priority+ navigation tiers. `always` links stay inline from `md` up;
 * `reveal-1`/`reveal-2` start inside the More menu and pop inline once the
 * header container is wide enough (otherwise they stay grouped); `more` links
 * always live under the More menu. The progressive reveal is pure CSS via
 * Tailwind v4 `@container` queries — no JS measurement, no layout shift.
 */
type NavTier = 'always' | 'reveal-1' | 'reveal-2' | 'more';
type NavLink = { label: string; href: string; tier: NavTier };

const navLinks: NavLink[] = [
  { label: 'Home', href: ROUTES.home, tier: 'always' },
  { label: 'Predictions', href: ROUTES.predictions, tier: 'always' },
  { label: 'Leaderboard', href: ROUTES.leaderboard, tier: 'always' },
  { label: 'Results', href: ROUTES.results, tier: 'reveal-1' },
  { label: 'Rules & Scoring', href: ROUTES.rules, tier: 'reveal-2' },
  { label: 'About', href: ROUTES.about, tier: 'more' },
  { label: 'Charities', href: ROUTES.charities, tier: 'more' },
  { label: 'Audit', href: ROUTES.audit, tier: 'more' },
];

// Reveal threshold per tier, keyed to the header container's inline size.
// `reveal-1` (Results) pops inline at ≥52rem, `reveal-2` (Rules) at ≥64rem.
// Each copy carries exactly one of these classes so the inline and More copies
// are never visible at the same width.
const INLINE_REVEAL_CLASS: Record<Exclude<NavTier, 'always' | 'more'>, string> = {
  'reveal-1': 'hidden @min-[52rem]:inline-flex',
  'reveal-2': 'hidden @min-[64rem]:inline-flex',
};
const MORE_HIDE_CLASS: Record<Exclude<NavTier, 'always' | 'more'>, string> = {
  'reveal-1': '@min-[52rem]:hidden',
  'reveal-2': '@min-[64rem]:hidden',
};

// Fluid type/spacing so the bar eases down before anything needs to collapse.
const NAV_LINK_PADDING = 'px-[clamp(0.5rem,1.2vw,1rem)]';

export function Header() {
  const pathname = usePathname();
  const mounted = useMounted();

  const isActive = (href: string) => {
    if (href === ROUTES.home) {
      return pathname === href;
    }
    return pathname.startsWith(href);
  };

  // Links eligible for the More menu (everything that isn't always-inline),
  // and whether the active route currently lives there. We only flag `more`
  // links as "active under More" — `reveal-*` links light up inline at the
  // widths where they're shown, so highlighting More for them would double up.
  const moreLinks = navLinks.filter((link) => link.tier !== 'always');
  const moreActive = navLinks.some((link) => link.tier === 'more' && isActive(link.href));

  return (
    <header className="border-border bg-background/95 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50 w-full border-b backdrop-blur">
      <div className="@container mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href={ROUTES.home} className="flex items-center space-x-2">
          <span className="text-foreground text-[clamp(1rem,0.9rem+0.5vw,1.25rem)] font-bold">
            soccer-pool 2026
          </span>
        </Link>

        <NavigationMenu className="hidden md:flex">
          <NavigationMenuList className="space-x-0 gap-[clamp(0.125rem,0.4vw,0.5rem)]">
            {navLinks
              .filter((link) => link.tier === 'always' || link.tier === 'reveal-1' || link.tier === 'reveal-2')
              .map((link) => (
                <NavigationMenuItem
                  key={link.href}
                  className={
                    link.tier === 'reveal-1' || link.tier === 'reveal-2'
                      ? INLINE_REVEAL_CLASS[link.tier]
                      : undefined
                  }
                >
                  <NavigationMenuLink asChild>
                    <Link
                      href={link.href}
                      className={cn(
                        navigationMenuTriggerStyle(),
                        NAV_LINK_PADDING,
                        isActive(link.href) && 'bg-accent text-accent-foreground font-semibold'
                      )}
                    >
                      {link.label}
                    </Link>
                  </NavigationMenuLink>
                </NavigationMenuItem>
              ))}
            <NavigationMenuItem>
              <MoreMenu links={moreLinks} isActive={isActive} active={moreActive} mounted={mounted} />
            </NavigationMenuItem>
          </NavigationMenuList>
        </NavigationMenu>

        <div className="hidden items-center gap-[clamp(0.5rem,1.5vw,1rem)] md:flex">
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

/**
 * The "More ▾" overflow menu for the desktop nav. Holds the lower-priority
 * links; `reveal-*` links carry a `@container` hide class so they drop out of
 * this list at the exact width their inline copy appears. Mirrors AuthMenu's
 * hydration dodge — a plain disabled placeholder renders until mount so the
 * Radix Popover's useId-driven aria-controls doesn't drift between SSR and
 * client.
 */
function MoreMenu({
  links,
  isActive,
  active,
  mounted,
}: {
  links: NavLink[];
  isActive: (href: string) => boolean;
  active: boolean;
  mounted: boolean;
}) {
  const triggerClass = cn(
    navigationMenuTriggerStyle(),
    NAV_LINK_PADDING,
    'gap-1',
    active && 'bg-accent text-accent-foreground font-semibold'
  );

  if (!mounted) {
    return (
      <button type="button" className={triggerClass} aria-label="More navigation" disabled>
        More
        <ChevronDown className="h-3 w-3" aria-hidden="true" />
      </button>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className={cn(triggerClass, 'group')} aria-label="More navigation">
          More
          <ChevronDown
            className="h-3 w-3 transition duration-200 group-data-[state=open]:rotate-180"
            aria-hidden="true"
          />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-52 p-2">
        <nav className="flex flex-col">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'hover:bg-accent hover:text-accent-foreground rounded-md px-3 py-2 text-sm transition-colors',
                isActive(link.href)
                  ? 'bg-accent text-accent-foreground font-semibold'
                  : 'text-muted-foreground',
                link.tier === 'reveal-1' || link.tier === 'reveal-2'
                  ? MORE_HIDE_CLASS[link.tier]
                  : undefined
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </PopoverContent>
    </Popover>
  );
}
