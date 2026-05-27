import { NextResponse, type NextRequest } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { safeMessage } from '@/lib/api/errors';
import {
  SUPPORT_TICKET_SUBJECTS,
  SUPPORT_TICKET_TITLE_MAX,
  SUPPORT_TICKET_DESCRIPTION_MAX,
  type SupportTicketSubject,
} from '@/lib/constants';

interface SupportTicketRow {
  id: string;
  subject: SupportTicketSubject;
  title: string;
  description: string;
  created_at: string;
}

interface CreatePayload {
  subject?: string;
  title?: string;
  description?: string;
}

function isValidSubject(value: string): value is SupportTicketSubject {
  return (SUPPORT_TICKET_SUBJECTS as readonly string[]).includes(value);
}

export async function GET() {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('support_tickets')
    .select('id, subject, title, description, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: safeMessage(error) }, { status: 400 });
  }

  return NextResponse.json({ tickets: (data ?? []) as SupportTicketRow[] });
}

export async function POST(request: NextRequest) {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as CreatePayload;

  const subject = typeof body.subject === 'string' ? body.subject.trim() : '';
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const description = typeof body.description === 'string' ? body.description.trim() : '';

  if (!subject || !isValidSubject(subject)) {
    return NextResponse.json(
      { error: 'subject invalid', field: 'subject' },
      { status: 400 }
    );
  }
  if (!title || title.length > SUPPORT_TICKET_TITLE_MAX) {
    return NextResponse.json(
      { error: `title must be 1–${SUPPORT_TICKET_TITLE_MAX} characters`, field: 'title' },
      { status: 400 }
    );
  }
  if (!description || description.length > SUPPORT_TICKET_DESCRIPTION_MAX) {
    return NextResponse.json(
      {
        error: `description must be 1–${SUPPORT_TICKET_DESCRIPTION_MAX} characters`,
        field: 'description',
      },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from('support_tickets')
    .insert({ user_id: user.id, subject, title, description })
    .select('id, subject, title, description, created_at')
    .single();

  if (error) {
    return NextResponse.json({ error: safeMessage(error) }, { status: 400 });
  }

  return NextResponse.json({ ticket: data as SupportTicketRow }, { status: 201 });
}
