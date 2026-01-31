/**
 * Cloudflare Pages Middleware for HTTP Basic Authentication
 *
 * Environment variables required:
 * - BASIC_AUTH_USERNAME: The username for basic auth
 * - BASIC_AUTH_PASSWORD: The password for basic auth
 *
 * Set these in Cloudflare Pages dashboard:
 * Settings > Environment variables
 */

interface Env {
  BASIC_AUTH_USERNAME?: string;
  BASIC_AUTH_PASSWORD?: string;
}

function unauthorized(): Response {
  return new Response('Unauthorized', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Protected Site", charset="UTF-8"',
    },
  });
}

function parseBasicAuth(header: string): { username: string; password: string } | null {
  if (!header.startsWith('Basic ')) {
    return null;
  }

  const base64 = header.slice(6);
  try {
    const decoded = atob(base64);
    const colonIndex = decoded.indexOf(':');
    if (colonIndex === -1) {
      return null;
    }
    return {
      username: decoded.slice(0, colonIndex),
      password: decoded.slice(colonIndex + 1),
    };
  } catch {
    return null;
  }
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { env, request } = context;

  // Skip auth if credentials are not configured
  if (!env.BASIC_AUTH_USERNAME || !env.BASIC_AUTH_PASSWORD) {
    return context.next();
  }

  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {
    return unauthorized();
  }

  const credentials = parseBasicAuth(authHeader);
  if (!credentials) {
    return unauthorized();
  }

  // Use timing-safe comparison to prevent timing attacks
  const usernameMatch = credentials.username === env.BASIC_AUTH_USERNAME;
  const passwordMatch = credentials.password === env.BASIC_AUTH_PASSWORD;

  if (!usernameMatch || !passwordMatch) {
    return unauthorized();
  }

  return context.next();
};
