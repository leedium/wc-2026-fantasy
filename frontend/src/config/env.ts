/**
 * Environment configuration
 */

interface EnvConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  appUrl: string;
}

function required(name: string, value: string | undefined, fallback?: string): string {
  if (!value || value === 'undefined') {
    if (fallback !== undefined) return fallback;
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function validateUrl(value: string, name: string): string {
  try {
    new URL(value);
  } catch {
    throw new Error(`Invalid URL for ${name}: "${value}"`);
  }
  return value;
}

function createEnvConfig(): EnvConfig {
  const supabaseUrl = validateUrl(
    required(
      'NEXT_PUBLIC_SUPABASE_URL',
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      'http://127.0.0.1:54321'
    ),
    'NEXT_PUBLIC_SUPABASE_URL'
  );
  const supabaseAnonKey = required(
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    'anon-key-placeholder'
  );
  const appUrl = validateUrl(
    required('NEXT_PUBLIC_APP_URL', process.env.NEXT_PUBLIC_APP_URL, 'http://localhost:3000'),
    'NEXT_PUBLIC_APP_URL'
  );

  return { supabaseUrl, supabaseAnonKey, appUrl };
}

export const env = createEnvConfig();
