import { createClient } from '@/utils/supabase/server';
import { createClient as createBrowserClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const INDOOR_TABLES = [
  'venues',
  'buildings',
  'levels',
  'spaces',
  'openings',
  'vertical_connectors',
  'routing_nodes',
  'routing_edges',
  'amenities',
  'occupants',
] as const;

export type IndoorTable = (typeof INDOOR_TABLES)[number];

export function isIndoorTable(s: string): s is IndoorTable {
  return INDOOR_TABLES.includes(s as IndoorTable);
}

export async function getSupabaseAndUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { supabase: null, user: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  return { supabase, user, error: null };
}

/** Read-only Supabase client using service role (bypasses RLS) for public GET access */
export function getPublicReadClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

/** Tables that have status column (soft-delete by setting status = 'archived') */
export const TABLES_WITH_STATUS: IndoorTable[] = [
  'venues',
  'buildings',
  'levels',
  'spaces',
  'openings',
  'vertical_connectors',
  'amenities',
  'occupants',
];
