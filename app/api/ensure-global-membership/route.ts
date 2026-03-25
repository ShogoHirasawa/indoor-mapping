import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

const GLOBAL_ORG_ID = 'c0eebc99-0000-4ef8-bb6d-6bb9bd380a11';

/**
 * Ensures the current user is a member of the Global organization (OSM-style shared map).
 * Idempotent - safe to call on every auth/session.
 */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: existing } = await supabase
    .schema('indoor')
    .from('organization_memberships')
    .select('id')
    .eq('organization_id', GLOBAL_ORG_ID)
    .eq('user_id', user.id)
    .single();

  if (existing) {
    return NextResponse.json({ ok: true, alreadyMember: true });
  }

  const { error: insertError } = await supabase
    .schema('indoor')
    .from('organization_memberships')
    .insert({
      organization_id: GLOBAL_ORG_ID,
      user_id: user.id,
      role: 'editor',
    });

  if (insertError) {
    return NextResponse.json(
      { error: insertError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, added: true });
}
