import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin, isAdminGateError } from '@/lib/auth/requireAdmin';
import { safeMessage } from '@/lib/api/errors';
import type { SupportTicketSubject } from '@/lib/constants';

interface AdminTicketRow {
  id: string;
  user_id: string;
  username: string | null;
  email: string | null;
  subject: SupportTicketSubject;
  title: string;
  description: string;
  created_at: string;
  total_count: number;
}

export async function GET(request: NextRequest) {
  const ctx = await requireAdmin();
  if (isAdminGateError(ctx)) return ctx.response;

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const pageSize = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get('pageSize') ?? '25', 10))
  );

  const { data, error } = await ctx.supabase.rpc('admin_list_support_tickets', {
    p_page: page,
    p_page_size: pageSize,
  });

  if (error) {
    return NextResponse.json({ error: safeMessage(error) }, { status: 500 });
  }

  const rows = (data ?? []) as AdminTicketRow[];

  return NextResponse.json({
    tickets: rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      username: r.username,
      email: r.email,
      subject: r.subject,
      title: r.title,
      description: r.description,
      createdAt: r.created_at,
    })),
    total: Number(rows[0]?.total_count ?? 0),
    page,
    pageSize,
  });
}

export async function DELETE(request: NextRequest) {
  const ctx = await requireAdmin();
  if (isAdminGateError(ctx)) return ctx.response;

  const body = (await request.json().catch(() => ({}))) as { id?: string };
  const id = typeof body.id === 'string' ? body.id.trim() : '';
  if (!id) {
    return NextResponse.json({ error: 'ticket id is required' }, { status: 400 });
  }

  const { error, count } = await ctx.supabase
    .from('support_tickets')
    .delete({ count: 'exact' })
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: safeMessage(error) }, { status: 400 });
  }
  if (!count) {
    return NextResponse.json({ error: 'ticket not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
