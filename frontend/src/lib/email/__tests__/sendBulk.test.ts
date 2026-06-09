/**
 * @jest-environment node
 */

// --- worker-mailer mock (Workers runtime path) ---
const wmSendMock = jest.fn();
const wmCloseMock = jest.fn().mockResolvedValue(undefined);
const wmConnectMock = jest.fn();
jest.mock('worker-mailer', () => ({
  WorkerMailer: { connect: (...args: unknown[]) => wmConnectMock(...args) },
}));

// --- nodemailer mock (Node / `next dev` path) ---
const nmSendMailMock = jest.fn();
const nmCloseMock = jest.fn();
const nmCreateTransportMock = jest.fn((config?: unknown) => {
  void config;
  return { sendMail: (...a: unknown[]) => nmSendMailMock(...a), close: () => nmCloseMock() };
});
jest.mock('nodemailer', () => ({
  __esModule: true,
  default: { createTransport: (...a: unknown[]) => nmCreateTransportMock(...a) },
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { sendBulkEmail, getSmtpConfig } = require('../sendBulk');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { MAX_RECIPIENTS_PER_SEND } = require('../sendBulk');

const ENV = {
  SMTP_HOST: 'smtpout.secureserver.net',
  SMTP_PORT: '465',
  SMTP_SECURE: 'true',
  SMTP_USER: 'pool@example.com',
  SMTP_PASS: 'secret',
  SMTP_FROM: 'World Cup Pool <pool@example.com>',
};

function setEnv(overrides: Record<string, string | undefined> = {}) {
  Object.assign(process.env, ENV, overrides);
}
function clearEnv() {
  for (const k of Object.keys(ENV)) delete process.env[k];
}

function setRuntime(workers: boolean) {
  // workerd identifies itself via navigator.userAgent.
  Object.defineProperty(globalThis, 'navigator', {
    value: { userAgent: workers ? 'Cloudflare-Workers' : 'Node.js' },
    configurable: true,
  });
}

beforeEach(() => {
  wmSendMock.mockReset().mockResolvedValue(undefined);
  wmCloseMock.mockClear();
  wmConnectMock.mockReset().mockResolvedValue({ send: wmSendMock, close: wmCloseMock });
  nmSendMailMock.mockReset().mockResolvedValue(undefined);
  nmCloseMock.mockClear();
  nmCreateTransportMock.mockClear();
  clearEnv();
  setRuntime(false);
});

describe('getSmtpConfig', () => {
  it('throws when SMTP env vars are missing', () => {
    expect(() => getSmtpConfig()).toThrow(/SMTP is not configured/);
  });

  it('uses implicit TLS on port 465 by default', () => {
    setEnv({ SMTP_SECURE: undefined });
    expect(getSmtpConfig()).toMatchObject({ port: 465, implicitTls: true, startTls: false });
  });

  it('uses STARTTLS (not implicit TLS) on 587 with SMTP_SECURE=true', () => {
    setEnv({ SMTP_PORT: '587', SMTP_SECURE: 'true' });
    expect(getSmtpConfig()).toMatchObject({ implicitTls: false, startTls: true });
  });

  it('uses no TLS at all when SMTP_SECURE=false (e.g. local Mailpit)', () => {
    setEnv({ SMTP_PORT: '54325', SMTP_SECURE: 'false' });
    expect(getSmtpConfig()).toMatchObject({ implicitTls: false, startTls: false });
  });
});

describe('sendBulkEmail on the Workers runtime', () => {
  beforeEach(() => setRuntime(true));

  it('sends one message per recipient over one worker-mailer connection', async () => {
    setEnv();
    const result = await sendBulkEmail({
      subject: 'Hi',
      html: '<p>x</p>',
      recipients: ['a@x.com', 'b@x.com'],
      delayMs: 0,
    });
    expect(wmConnectMock).toHaveBeenCalledTimes(1);
    expect(wmConnectMock).toHaveBeenCalledWith(
      expect.objectContaining({ secure: true, startTls: false })
    );
    expect(wmSendMock).toHaveBeenCalledTimes(2);
    expect(wmSendMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'a@x.com', subject: 'Hi', html: '<p>x</p>' })
    );
    expect(wmCloseMock).toHaveBeenCalledTimes(1);
    expect(nmCreateTransportMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({ sent: 2, failed: 0, skipped: 0 });
  });

  it('records per-recipient failures without aborting the batch', async () => {
    setEnv();
    wmSendMock
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('mailbox full'))
      .mockResolvedValueOnce(undefined);
    const result = await sendBulkEmail({
      subject: 'Hi',
      html: '<p>x</p>',
      recipients: ['a@x.com', 'b@x.com', 'c@x.com'],
      delayMs: 0,
    });
    expect(result).toMatchObject({ sent: 2, failed: 1 });
    expect(result.errors[0]).toMatchObject({ email: 'b@x.com', error: 'mailbox full' });
    expect(wmCloseMock).toHaveBeenCalledTimes(1);
  });

  it('caps at MAX_RECIPIENTS_PER_SEND and reports the surplus as skipped', async () => {
    setEnv();
    const recipients = Array.from(
      { length: MAX_RECIPIENTS_PER_SEND + 5 },
      (_, i) => `user${i}@x.com`
    );
    const result = await sendBulkEmail({ subject: 'Hi', html: '<p>x</p>', recipients, delayMs: 0 });
    expect(result.sent).toBe(MAX_RECIPIENTS_PER_SEND);
    expect(result.skipped).toBe(5);
  });
});

describe('sendBulkEmail under Node (next dev)', () => {
  beforeEach(() => setRuntime(false));

  it('falls back to nodemailer with STARTTLS on 587', async () => {
    setEnv({ SMTP_HOST: 'smtp.office365.com', SMTP_PORT: '587' });
    const result = await sendBulkEmail({
      subject: 'Hi',
      html: '<p>x</p>',
      recipients: ['A@x.com', 'a@x.com', 'b@x.com'],
      delayMs: 0,
    });
    expect(nmCreateTransportMock).toHaveBeenCalledWith(
      expect.objectContaining({ port: 587, secure: false, requireTLS: true })
    );
    // dedupes A@/a@ to one
    expect(nmSendMailMock).toHaveBeenCalledTimes(2);
    expect(wmConnectMock).not.toHaveBeenCalled();
    expect(nmCloseMock).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ sent: 2, failed: 0 });
  });

  it('connects to plain SMTP (Mailpit) with no TLS when SMTP_SECURE=false', async () => {
    setEnv({ SMTP_HOST: '127.0.0.1', SMTP_PORT: '54325', SMTP_SECURE: 'false' });
    await sendBulkEmail({ subject: 'Hi', html: '<p>x</p>', recipients: ['a@x.com'], delayMs: 0 });
    expect(nmCreateTransportMock).toHaveBeenCalledWith(
      expect.objectContaining({ host: '127.0.0.1', port: 54325, secure: false, requireTLS: false })
    );
  });
});

describe('sendBulkEmail config errors', () => {
  it('throws (and never connects) when SMTP is not configured', async () => {
    setRuntime(true);
    await expect(
      sendBulkEmail({ subject: 'Hi', html: '<p>x</p>', recipients: ['a@x.com'], delayMs: 0 })
    ).rejects.toThrow(/SMTP is not configured/);
    expect(wmConnectMock).not.toHaveBeenCalled();
  });
});
