import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

/**
 * POST /api/organizations
 * Create a new organization and add the current user as owner.
 * Body: { name: string }
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { name?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }

  const { data: org, error: orgError } = await supabase
    .schema('indoor')
    .from('organizations')
    .insert({ name })
    .select('id, name')
    .single();

  if (orgError) {
    return NextResponse.json({ error: orgError.message }, { status: 400 });
  }

  const { error: memError } = await supabase
    .schema('indoor')
    .from('organization_memberships')
    .insert({
      organization_id: org.id,
      user_id: user.id,
      role: 'owner',
    });

  if (memError) {
    return NextResponse.json({ error: memError.message }, { status: 400 });
  }

  return NextResponse.json(org, { status: 201 });
}
