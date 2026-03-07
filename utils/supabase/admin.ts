import { createClient } from '@supabase/supabase-js';

/**
 * Server-only Supabase client with service role key.
 * Use only in API routes / server actions for admin operations (e.g. delete user).
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for admin operations');
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}
