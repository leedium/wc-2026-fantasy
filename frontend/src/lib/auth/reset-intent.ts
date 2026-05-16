import { createHmac, timingSafeEqual } from 'node:crypto';

export const RESET_INTENT_COOKIE = 'reset_intent';
const TTL_SECONDS = 900;

interface CookieOptions {
  httpOnly: true;
  secure: boolean;
  sameSite: 'strict';
  path: string;
  maxAge: number;
}

function baseOptions(maxAge: number): CookieOptions {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/auth/reset-password',
    maxAge,
  };
}

function getSecret(): string {
  const secret = process.env.RESET_INTENT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('RESET_INTENT_SECRET must be set to at least 32 characters');
  }
  return secret;
}

function hmac(message: string): string {
  return createHmac('sha256', getSecret()).update(message).digest('base64url');
}

export function signResetIntent(userId: string) {
  const iat = Math.floor(Date.now() / 1000);
  const mac = hmac(`${userId}.${iat}`);
  return {
    name: RESET_INTENT_COOKIE,
    value: `${iat}.${mac}`,
    options: baseOptions(TTL_SECONDS),
  };
}

export function verifyResetIntent(cookieValue: string | undefined, userId: string): boolean {
  if (!cookieValue) return false;
  const dot = cookieValue.indexOf('.');
  if (dot <= 0) return false;
  const iatStr = cookieValue.slice(0, dot);
  const mac = cookieValue.slice(dot + 1);
  const iat = Number.parseInt(iatStr, 10);
  if (!Number.isFinite(iat)) return false;

  const now = Math.floor(Date.now() / 1000);
  if (now < iat || now - iat > TTL_SECONDS) return false;

  const expected = hmac(`${userId}.${iat}`);
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function clearResetIntentCookie() {
  return {
    name: RESET_INTENT_COOKIE,
    value: '',
    options: baseOptions(0),
  };
}
