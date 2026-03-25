import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: venues, error } = await supabase
    .schema('indoor')
    .from('venues')
    .select('id, name, status');

  return NextResponse.json({
    user: user.email,
    venues,
    error: error?.message,
  });
}
