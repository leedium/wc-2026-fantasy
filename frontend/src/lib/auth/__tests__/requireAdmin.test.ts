/**
 * @jest-environment node
 */
export {}; // makes this file a module so the top-level `const` doesn't
           // collide with identically-named consts in sibling tests.

const supabaseMock = {
  auth: { getUser: jest.fn() },
  from: jest.fn(),
};

jest.mock('@/lib/supabase/server', () => ({
  getServerSupabase: async () => supabaseMock,
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { requireAdmin, isAdminGateError } = require('../requireAdmin');

describe('requireAdmin', () => {
  beforeEach(() => {
    supabaseMock.auth.getUser.mockReset();
    supabaseMock.from.mockReset();
  });

  it('returns 401 gate when unauthenticated', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: null } });
    const result = await requireAdmin();
    expect(isAdminGateError(result)).toBe(true);
    if (isAdminGateError(result)) {
      expect(result.response.status).toBe(401);
    }
  });

  it('returns 403 gate when authenticated but not admin', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    supabaseMock.from.mockImplementation(() => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: { is_admin: false } }) }),
      }),
    }));
    const result = await requireAdmin();
    expect(isAdminGateError(result)).toBe(true);
    if (isAdminGateError(result)) {
      expect(result.response.status).toBe(403);
    }
  });

  it('returns context for admin users', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    supabaseMock.from.mockImplementation(() => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: { is_admin: true } }) }),
      }),
    }));
    const result = await requireAdmin();
    expect(isAdminGateError(result)).toBe(false);
    if (!isAdminGateError(result)) {
      expect(result.user.id).toBe('u1');
    }
  });
});
