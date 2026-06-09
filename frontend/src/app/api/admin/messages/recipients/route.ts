import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin, isAdminGateError } from '@/lib/auth/requireAdmin';
import { safeMessage } from '@/lib/api/errors';

// Returns the recipient count for the admin broadcast confirm dialog.
// ?paidOnly=true restricts to users with a paid entry in the active tournament.
export async function GET(request: NextRequest) {
  const ctx = await requireAdmin();
  if (isAdminGateError(ctx)) return ctx.response;

  const { searchParams } = new URL(request.url);
  const paidOnly = searchParams.get('paidOnly') === 'true';

  const { data, error } = await ctx.supabase.rpc('admin_list_recipient_emails', {
    p_paid_only: paidOnly,
  });

  if (error) {
    return NextResponse.json({ error: safeMessage(error) }, { status: 500 });
  }

  const rows = (data ?? []) as Array<{ email: string }>;
  return NextResponse.json({ count: rows.length, paidOnly });
}
