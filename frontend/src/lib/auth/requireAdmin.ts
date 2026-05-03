import { NextResponse } from 'next/server';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { getServerSupabase } from '@/lib/supabase/server';

export type AdminContext = {
  supabase: SupabaseClient;
  user: User;
};

export type AdminGateError = { response: NextResponse };

export function isAdminGateError(value: unknown): value is AdminGateError {
  return typeof value === 'object' && value !== null && 'response' in value;
}

export async function requireAdmin(): Promise<AdminContext | AdminGateError> {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile?.is_admin) {
    return { response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { supabase, user };
}
