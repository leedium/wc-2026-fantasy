/**
 * @jest-environment node
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { sendBulkEmail } = require('../sendBulk');

const ENV = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://proj.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
  BROADCAST_SHARED_SECRET: 'shh',
};

function setEnv(overrides: Record<string, string | undefined> = {}) {
  Object.assign(process.env, ENV, overrides);
}
function clearEnv() {
  for (const k of Object.keys(ENV)) delete process.env[k];
}

const fetchMock = jest.fn();

beforeEach(() => {
  clearEnv();
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
});

describe('sendBulkEmail', () => {
  it('throws when broadcast env is not configured', async () => {
    await expect(
      sendBulkEmail({ subject: 'Hi', html: '<p>x</p>', recipients: ['a@x.com'] })
    ).rejects.toThrow(/broadcast is not configured/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('POSTs to the send-broadcast function with secret + anon headers and returns the result', async () => {
    setEnv();
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ sent: 2, failed: 0, skipped: 0, errors: [] }),
    });

    const result = await sendBulkEmail({
      subject: 'Hi',
      html: '<p>x</p>',
      recipients: ['a@x.com', 'b@x.com'],
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://proj.supabase.co/functions/v1/send-broadcast');
    expect(init.method).toBe('POST');
    expect(init.headers['x-broadcast-secret']).toBe('shh');
    expect(init.headers.apikey).toBe('anon-key');
    expect(init.headers.Authorization).toBe('Bearer anon-key');
    expect(JSON.parse(init.body)).toEqual({
      subject: 'Hi',
      html: '<p>x</p>',
      recipients: ['a@x.com', 'b@x.com'],
    });
    expect(result).toMatchObject({ sent: 2, failed: 0, skipped: 0 });
  });

  it('strips a trailing slash from the Supabase URL', async () => {
    setEnv({ NEXT_PUBLIC_SUPABASE_URL: 'https://proj.supabase.co/' });
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ sent: 1, failed: 0, skipped: 0 }) });
    await sendBulkEmail({ subject: 'Hi', html: '<p>x</p>', recipients: ['a@x.com'] });
    expect(fetchMock.mock.calls[0][0]).toBe('https://proj.supabase.co/functions/v1/send-broadcast');
  });

  it('throws with the function error message on a non-2xx response', async () => {
    setEnv();
    fetchMock.mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => ({ error: 'server does not advertise AUTH' }),
    });
    await expect(
      sendBulkEmail({ subject: 'Hi', html: '<p>x</p>', recipients: ['a@x.com'] })
    ).rejects.toThrow(/server does not advertise AUTH/);
  });
});
