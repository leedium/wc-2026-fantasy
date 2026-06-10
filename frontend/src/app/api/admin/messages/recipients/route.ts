import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin, isAdminGateError } from '@/lib/auth/requireAdmin';
import { safeMessage } from '@/lib/api/errors';

export const RECIPIENT_SEGMENTS = ['all', 'paid', 'unpaid', 'no_prediction'] as const;
export type RecipientSegment = (typeof RECIPIENT_SEGMENTS)[number];

export function normalizeSegment(value: string | null | undefined): RecipientSegment {
  return RECIPIENT_SEGMENTS.includes(value as RecipientSegment) ? (value as RecipientSegment) : 'all';
}

// Returns the recipient count for the admin broadcast confirm dialog.
// ?segment=all|paid|unpaid|no_prediction (scoped to the active tournament).
export async function GET(request: NextRequest) {
  const ctx = await requireAdmin();
  if (isAdminGateError(ctx)) return ctx.response;

  const { searchParams } = new URL(request.url);
  const segment = normalizeSegment(searchParams.get('segment'));

  const { data, error } = await ctx.supabase.rpc('admin_list_recipient_emails', {
    p_segment: segment,
  });

  if (error) {
    return NextResponse.json({ error: safeMessage(error) }, { status: 500 });
  }

  const rows = (data ?? []) as Array<{ email: string }>;
  return NextResponse.json({ count: rows.length, segment });
}
