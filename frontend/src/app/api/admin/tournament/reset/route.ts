import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin, isAdminGateError } from '@/lib/auth/requireAdmin';
import { safeMessage } from '@/lib/api/errors';

interface Body {
  id?: string;
  confirm?: string;
}

export async function POST(request: NextRequest) {
  const ctx = await requireAdmin();
  if (isAdminGateError(ctx)) return ctx.response;

  const body = (await request.json()) as Body;
  if (!body.id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }
  if (body.confirm !== 'RESET') {
    return NextResponse.json({ error: 'confirm must be "RESET"' }, { status: 400 });
  }

  const { error } = await ctx.supabase.rpc('admin_reset_tournament', {
    p_tournament_id: body.id,
  });

  if (error) {
    const msg = (error.message ?? '').toLowerCase();
    let status = 400;
    if (msg.includes('forbidden')) status = 403;
    else if (msg.includes('not found')) status = 404;
    return NextResponse.json({ error: safeMessage(error) }, { status });
  }

  return NextResponse.json({ ok: true });
}
