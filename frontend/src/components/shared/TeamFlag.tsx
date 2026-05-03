import { createElement } from 'react';
import { cn } from '@/lib/utils';
import { getTeamFlag } from '@/lib/team-flags';

export interface TeamFlagProps {
  code: string;
  className?: string;
}

// `flag` is a stable component reference looked up from a static map, but the
// `react-hooks/static-components` lint heuristic flags any PascalCase binding
// inside a component as "created during render". Using `createElement` with a
// lowercase variable sidesteps that without changing semantics.
export function TeamFlag({ code, className }: TeamFlagProps) {
  const flag = getTeamFlag(code);
  if (!flag) return null;
  return createElement(flag, {
    'aria-hidden': 'true',
    className: cn('h-3 w-5 shrink-0 rounded-sm border border-black/10', className),
  });
}
