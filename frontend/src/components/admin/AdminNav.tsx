'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const links = [
  { label: 'Dashboard', href: '/admin' },
  { label: 'Results', href: '/admin/results' },
  { label: 'Users', href: '/admin/users' },
  { label: 'Tournament', href: '/admin/tournament' },
  { label: 'Advancers', href: '/admin/advancers' },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="border-border mb-8 flex flex-wrap gap-1 border-b">
      {links.map((l) => {
        const active = l.href === '/admin' ? pathname === l.href : pathname.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            className={cn(
              'rounded-t-md px-4 py-2 text-sm font-medium transition-colors',
              active
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
