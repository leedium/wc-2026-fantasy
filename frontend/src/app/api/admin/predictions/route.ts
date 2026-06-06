import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin, isAdminGateError } from '@/lib/auth/requireAdmin';
import { safeMessage } from '@/lib/api/errors';

export async function GET(request: NextRequest) {
  const ctx = await requireAdmin();
  if (isAdminGateError(ctx)) return ctx.response;

  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') ?? '';
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') ?? '25', 10)));

  const { data, error } = await ctx.supabase.rpc('admin_list_predictions', {
    p_search: search,
    p_page: page,
    p_page_size: pageSize,
  });
  if (error) return NextResponse.json({ error: safeMessage(error) }, { status: 500 });

  const rows = (data ?? []) as Array<{
    id: string;
    user_id: string;
    username: string;
    email: string | null;
    prediction_name: string | null;
    submitted_at: string | null;
    updated_at: string;
    total_count: number;
  }>;

  return NextResponse.json({
    predictions: rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      username: r.username,
      email: r.email ?? null,
      predictionName: r.prediction_name,
      submittedAt: r.submitted_at,
      updatedAt: r.updated_at,
    })),
    total: Number(rows[0]?.total_count ?? 0),
    page,
    pageSize,
  });
}
