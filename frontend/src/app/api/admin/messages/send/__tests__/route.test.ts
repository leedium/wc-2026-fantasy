/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';

const supabaseMock = {
  auth: { getUser: jest.fn() },
  from: jest.fn(),
  rpc: jest.fn(),
};

const sendBulkEmailMock = jest.fn();

jest.mock('@/lib/supabase/server', () => ({
  getServerSupabase: async () => supabaseMock,
}));

jest.mock('@/lib/email/sendBulk', () => ({
  sendBulkEmail: (...args: unknown[]) => sendBulkEmailMock(...args),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { POST } = require('../route');

function postReq(body: unknown) {
  return new NextRequest('http://localhost:3000/api/admin/messages/send', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function mockAdminProfile(isAdmin: boolean) {
  supabaseMock.from.mockImplementation(() => ({
    select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { is_admin: isAdmin } }) }) }),
  }));
}

const adminUser = { id: 'u1', email: 'admin@x.com' };

beforeEach(() => {
  supabaseMock.auth.getUser.mockReset();
  supabaseMock.from.mockReset();
  supabaseMock.rpc.mockReset();
  sendBulkEmailMock.mockReset().mockResolvedValue({ sent: 1, failed: 0, skipped: 0, errors: [] });
});

describe('POST /api/admin/messages/send', () => {
  it('returns 401 when unauthenticated', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: null } });
    const res = await POST(postReq({ subject: 'Hi', html: '<p>x</p>' }));
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-admin', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: adminUser } });
    mockAdminProfile(false);
    const res = await POST(postReq({ subject: 'Hi', html: '<p>x</p>' }));
    expect(res.status).toBe(403);
  });

  it('returns 400 when subject is empty', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: adminUser } });
    mockAdminProfile(true);
    const res = await POST(postReq({ subject: '   ', html: '<p>x</p>' }));
    expect(res.status).toBe(400);
    expect(sendBulkEmailMock).not.toHaveBeenCalled();
  });

  it('returns 400 when body is empty', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: adminUser } });
    mockAdminProfile(true);
    const res = await POST(postReq({ subject: 'Hi', html: '   ' }));
    expect(res.status).toBe(400);
    expect(sendBulkEmailMock).not.toHaveBeenCalled();
  });

  it('test mode sends only to the calling admin and skips the RPC', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: adminUser } });
    mockAdminProfile(true);
    const res = await POST(postReq({ subject: 'Hi', html: '<p>x</p>', test: true }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ sent: 1, test: true });
    expect(supabaseMock.rpc).not.toHaveBeenCalled();
    expect(sendBulkEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({ recipients: ['admin@x.com'], subject: 'Hi' })
    );
  });

  it('broadcast mode fetches recipients via RPC and sends to them', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: adminUser } });
    mockAdminProfile(true);
    supabaseMock.rpc.mockResolvedValue({
      data: [{ email: 'a@x.com' }, { email: 'b@x.com' }],
      error: null,
    });
    sendBulkEmailMock.mockResolvedValue({ sent: 2, failed: 0, skipped: 0, errors: [] });
    const res = await POST(postReq({ subject: 'Hi', html: '<p>x</p>', segment: 'unpaid' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ sent: 2, test: false });
    expect(supabaseMock.rpc).toHaveBeenCalledWith('admin_list_recipient_emails', {
      p_segment: 'unpaid',
    });
    expect(sendBulkEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({ recipients: ['a@x.com', 'b@x.com'] })
    );
  });

  it('returns 400 when no recipients match', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: adminUser } });
    mockAdminProfile(true);
    supabaseMock.rpc.mockResolvedValue({ data: [], error: null });
    const res = await POST(postReq({ subject: 'Hi', html: '<p>x</p>' }));
    expect(res.status).toBe(400);
    expect(sendBulkEmailMock).not.toHaveBeenCalled();
  });

  it('returns 500 when sendBulkEmail throws (e.g. SMTP not configured)', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: adminUser } });
    mockAdminProfile(true);
    sendBulkEmailMock.mockRejectedValue(new Error('SMTP is not configured: set SMTP_HOST'));
    const res = await POST(postReq({ subject: 'Hi', html: '<p>x</p>', test: true }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/SMTP is not configured/);
  });
});
