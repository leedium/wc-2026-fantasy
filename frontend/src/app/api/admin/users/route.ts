import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin, isAdminGateError } from '@/lib/auth/requireAdmin';

export async function GET(request: NextRequest) {
  const ctx = await requireAdmin();
  if (isAdminGateError(ctx)) return ctx.response;

  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') ?? '';
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') ?? '25', 10)));

  const { data, error } = await ctx.supabase.rpc('admin_list_users', {
    p_search: search,
    p_page: page,
    p_page_size: pageSize,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []) as Array<{
    id: string;
    username: string;
    is_admin: boolean;
    has_prediction: boolean;
    submitted_at: string | null;
    total_count: number;
  }>;

  return NextResponse.json({
    users: rows.map((r) => ({
      id: r.id,
      username: r.username,
      isAdmin: r.is_admin,
      hasPrediction: r.has_prediction,
      submittedAt: r.submitted_at,
    })),
    total: Number(rows[0]?.total_count ?? 0),
    page,
    pageSize,
  });
}
