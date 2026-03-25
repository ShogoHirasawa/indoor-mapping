import { NextRequest, NextResponse } from 'next/server';
import { getPublicReadClient } from '../_lib';
import { createClient } from '@/utils/supabase/server';

const GLOBAL_ORG_ID = 'c0eebc99-0000-4ef8-bb6d-6bb9bd380a11';

/**
 * GET /api/indoor/context
 * Returns the current user's organizations and optionally venues for a given organization.
 * For unauthenticated users, returns the Global organization and its venues.
 * Query: ?organization_id=xxx to get venues for that org (default: first org).
 */
export async function GET(request: NextRequest) {
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();

  // Use authenticated client if logged in, otherwise service role for public read
  const supabase = user ? authClient : getPublicReadClient();

  let orgIds: string[];

  if (user) {
    const { data: memberships } = await supabase
      .schema('indoor')
      .from('organization_memberships')
      .select('organization_id')
      .eq('user_id', user.id);
    orgIds = (memberships ?? []).map((m) => m.organization_id);
  } else {
    // Unauthenticated: show Global org only
    orgIds = [GLOBAL_ORG_ID];
  }

  if (orgIds.length === 0) {
    return NextResponse.json({ organizations: [], organizationId: null, venues: [] });
  }

  const { data: orgRows } = await supabase
    .schema('indoor')
    .from('organizations')
    .select('id, name')
    .in('id', orgIds);

  const organizations = (orgRows ?? []).map((o) => ({ id: o.id, name: o.name }));

  const { searchParams } = new URL(request.url);
  const requestedOrgId = searchParams.get('organization_id');
  const orgId = requestedOrgId && orgIds.includes(requestedOrgId)
    ? requestedOrgId
    : orgIds[0];

  const { data: venues, error: venuesError } = await supabase
    .schema('indoor')
    .from('venues')
    .select('id, name')
    .eq('organization_id', orgId)
    .neq('status', 'archived');

  if (venuesError) {
    return NextResponse.json({ error: venuesError.message }, { status: 400 });
  }

  return NextResponse.json({
    organizations,
    organizationId: orgId,
    venues: (venues ?? []).map((v) => ({ id: v.id, name: v.name })),
  });
}
