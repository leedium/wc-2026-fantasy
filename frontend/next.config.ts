import type { NextConfig } from 'next';

const isDev = process.env.NODE_ENV === 'development';

// Hosts the app talks to. Supabase project is on *.supabase.co; in dev we
// also allow the local stack at 127.0.0.1:54321 / localhost:* for SSR
// fetches and websocket realtime channels.
const supabaseConnect = ['https://*.supabase.co', 'wss://*.supabase.co'];
const devConnect = isDev
  ? [
      'http://127.0.0.1:*',
      'ws://127.0.0.1:*',
      'http://localhost:*',
      'ws://localhost:*',
    ]
  : [];

// Note: Next.js App Router embeds inline scripts for hydration data, and
// Radix UI / Tailwind use inline styles. 'unsafe-inline' is currently
// required for both. Tightening with nonces is a separate workstream.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  `connect-src 'self' ${[...supabaseConnect, ...devConnect].join(' ')}`,
  "font-src 'self' data:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  'upgrade-insecure-requests',
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
  },
  // Start at 1 year. Bump to 2 years + preload after a confidence period.
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
];

const nextConfig: NextConfig = {
  // Don't let Next/Turbopack compile worker-mailer: it would rewrite the
  // package's `import { connect } from "cloudflare:sockets"` into a CJS
  // `require("cloudflare:sockets")`, which throws "Dynamic require ... not
  // supported" on the workerd runtime. Left external, its ESM import survives
  // to the OpenNext esbuild step (where cloudflare:sockets is marked external),
  // so the final worker keeps a static ESM import that workerd resolves.
  serverExternalPackages: ['worker-mailer'],
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
