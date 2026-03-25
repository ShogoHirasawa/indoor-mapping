import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

const GLOBAL_ORG_ID = 'c0eebc99-0000-4ef8-bb6d-6bb9bd380a11';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      // Ensure user is in Global org (OSM-style shared map)
      const { data: existing } = await supabase
        .schema('indoor')
        .from('organization_memberships')
        .select('id')
        .eq('organization_id', GLOBAL_ORG_ID)
        .eq('user_id', data.user.id)
        .single();
      if (!existing) {
        await supabase
          .schema('indoor')
          .from('organization_memberships')
          .insert({
            organization_id: GLOBAL_ORG_ID,
            user_id: data.user.id,
            role: 'editor',
          });
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', data.user.id)
        .single();
      const redirectTo = profile ? next : '/set-username';
      return NextResponse.redirect(`${origin}${redirectTo}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
