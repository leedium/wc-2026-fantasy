import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin, isAdminGateError } from '@/lib/auth/requireAdmin';
import { safeMessage } from '@/lib/api/errors';
import { sendBulkEmail } from '@/lib/email/sendBulk';

const MAX_SUBJECT_LENGTH = 200;
const MAX_HTML_LENGTH = 200_000;

// Sends a broadcast email. test:true delivers only to the calling admin;
// test:false fetches recipients (all users, or paid-only) and sends to each.
export async function POST(request: NextRequest) {
  const ctx = await requireAdmin();
  if (isAdminGateError(ctx)) return ctx.response;

  const body = (await request.json().catch(() => ({}))) as {
    subject?: string;
    html?: string;
    paidOnly?: boolean;
    test?: boolean;
  };

  const subject = typeof body.subject === 'string' ? body.subject.trim() : '';
  const html = typeof body.html === 'string' ? body.html : '';
  const paidOnly = body.paidOnly === true;
  const test = body.test === true;

  if (!subject || subject.length > MAX_SUBJECT_LENGTH) {
    return NextResponse.json(
      { error: `subject is required (max ${MAX_SUBJECT_LENGTH} characters)` },
      { status: 400 }
    );
  }
  if (!html.trim() || html.length > MAX_HTML_LENGTH) {
    return NextResponse.json(
      { error: `message body is required (max ${MAX_HTML_LENGTH} characters)` },
      { status: 400 }
    );
  }

  // Resolve recipients.
  let recipients: string[];
  if (test) {
    if (!ctx.user.email) {
      return NextResponse.json({ error: 'your account has no email address' }, { status: 400 });
    }
    recipients = [ctx.user.email];
  } else {
    const { data, error } = await ctx.supabase.rpc('admin_list_recipient_emails', {
      p_paid_only: paidOnly,
    });
    if (error) {
      return NextResponse.json({ error: safeMessage(error) }, { status: 500 });
    }
    recipients = ((data ?? []) as Array<{ email: string }>).map((r) => r.email);
    if (recipients.length === 0) {
      return NextResponse.json({ error: 'no recipients match' }, { status: 400 });
    }
  }

  try {
    const result = await sendBulkEmail({ subject, html, recipients });
    return NextResponse.json({
      sent: result.sent,
      failed: result.failed,
      skipped: result.skipped,
      test,
    });
  } catch (err) {
    // Most likely missing SMTP config; surface a generic 500.
    console.error('[messages/send] sendBulkEmail failed:', err);
    const message =
      err instanceof Error && err.message.startsWith('SMTP is not configured')
        ? err.message
        : 'failed to send email';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
