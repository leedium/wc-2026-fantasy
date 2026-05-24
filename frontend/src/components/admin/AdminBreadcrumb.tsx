import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

import { cn } from '@/lib/utils';

export interface AdminBreadcrumbItem {
  label: string;
  href?: string;
}

interface AdminBreadcrumbProps {
  items: AdminBreadcrumbItem[];
  className?: string;
}

/**
 * Lightweight breadcrumb used to escape nested Admin/User views. The last
 * item is treated as the current page (rendered non-interactive) regardless
 * of whether it has an href.
 */
export function AdminBreadcrumb({ items, className }: AdminBreadcrumbProps) {
  if (items.length === 0) return null;
  return (
    <nav aria-label="Breadcrumb" className={cn('mb-4 text-sm', className)}>
      <ol className="text-muted-foreground flex flex-wrap items-center gap-1">
        {items.map((item, i) => {
          const isLast = i === items.length - 1;
          return (
            <li key={`${item.label}-${i}`} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="h-3.5 w-3.5" aria-hidden />}
              {item.href && !isLast ? (
                <Link
                  href={item.href}
                  className="hover:text-foreground transition-colors"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  className={cn(isLast && 'text-foreground font-medium')}
                  aria-current={isLast ? 'page' : undefined}
                >
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
