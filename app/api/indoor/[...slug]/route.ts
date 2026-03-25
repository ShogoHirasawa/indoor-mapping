import { NextRequest, NextResponse } from 'next/server';
import {
  getSupabaseAndUser,
  getPublicReadClient,
  isIndoorTable,
  type IndoorTable,
  TABLES_WITH_STATUS,
} from '../_lib';
import { createClient } from '@/utils/supabase/server';
import { mapRowsGeomToGeojson } from '../geomToGeojson';

type RouteContext = { params: Promise<{ slug: string[] }> };

export async function GET(request: NextRequest, context: RouteContext) {
  // Try authenticated client first; fall back to public read-only client
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  const supabase = user ? authClient : getPublicReadClient();

  const { slug } = await context.params;
  const table = slug?.[0];
  const id = slug?.[1];

  if (!table || !isIndoorTable(table)) {
    return NextResponse.json({ error: 'Invalid resource' }, { status: 400 });
  }

  const q = supabase.schema('indoor').from(table);

  if (id) {
    const { data, error: e } = await q.select('*').eq('id', id).single();
    if (e) {
      if (e.code === 'PGRST116') return NextResponse.json({ error: 'Not found' }, { status: 404 });
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    const out = data ? mapRowsGeomToGeojson(table, [data])[0] : data;
    return NextResponse.json(out);
  }

  const { searchParams } = new URL(request.url);
  let query = q.select('*');
  if (table === 'venues' && searchParams.has('organization_id')) {
    query = query.eq('organization_id', searchParams.get('organization_id')!);
  } else if (table === 'buildings' && searchParams.has('venue_id')) {
    query = query.eq('venue_id', searchParams.get('venue_id')!);
  } else if (table === 'levels' && searchParams.has('building_id')) {
    query = query.eq('building_id', searchParams.get('building_id')!).order('ordinal');
  } else if ((table === 'spaces' || table === 'openings' || table === 'amenities' || table === 'occupants') && searchParams.has('level_id')) {
    query = query.eq('level_id', searchParams.get('level_id')!);
  } else if (table === 'spaces' && searchParams.has('building_id')) {
    query = query.eq('building_id', searchParams.get('building_id')!);
  } else if (table === 'spaces' && searchParams.has('venue_id')) {
    query = query.eq('venue_id', searchParams.get('venue_id')!);
  } else if ((table === 'vertical_connectors' || table === 'routing_nodes' || table === 'routing_edges') && searchParams.has('building_id')) {
    query = query.eq('building_id', searchParams.get('building_id')!);
  } else if (table === 'routing_edges' && searchParams.has('venue_id')) {
    query = query.eq('venue_id', searchParams.get('venue_id')!);
  } else if (table === 'venues' && !searchParams.has('organization_id')) {
    return NextResponse.json({ error: 'organization_id required for venues list' }, { status: 400 });
  }

  const { data, error: e } = await query;
  if (e) return NextResponse.json({ error: e.message }, { status: 400 });
  const rows = data ?? [];
  const out = mapRowsGeomToGeojson(table, rows);
  return NextResponse.json(out);
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { supabase, user, error } = await getSupabaseAndUser();
  if (error) return error;
  if (!supabase || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { slug } = await context.params;
  const table = slug?.[0];
  if (!table || !isIndoorTable(table) || slug.length > 1) {
    return NextResponse.json({ error: 'Invalid resource for POST' }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const payload: Record<string, unknown> = { ...body, updated_by: user.id };
  if (TABLES_WITH_STATUS.includes(table as IndoorTable)) {
    payload.created_by = user.id;
    if (payload.status == null) payload.status = 'draft';
  }

  const { data, error: e } = await supabase
    .schema('indoor')
    .from(table)
    .insert(payload)
    .select()
    .single();

  if (e) return NextResponse.json({ error: e.message }, { status: 400 });
  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { supabase, user, error } = await getSupabaseAndUser();
  if (error) return error;
  if (!supabase || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { slug } = await context.params;
  const table = slug?.[0];
  const id = slug?.[1];
  if (!table || !isIndoorTable(table) || !id) {
    return NextResponse.json({ error: 'Invalid resource or id for PATCH' }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const payload = { ...body, updated_by: user.id };

  const { data, error: e } = await supabase
    .schema('indoor')
    .from(table)
    .update(payload)
    .eq('id', id)
    .select()
    .single();

  if (e) return NextResponse.json({ error: e.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const { supabase, user, error } = await getSupabaseAndUser();
  if (error) return error;
  if (!supabase || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { slug } = await context.params;
  const table = slug?.[0];
  const id = slug?.[1];
  if (!table || !isIndoorTable(table) || !id) {
    return NextResponse.json({ error: 'Invalid resource or id for DELETE' }, { status: 400 });
  }

  const hasStatus = TABLES_WITH_STATUS.includes(table as IndoorTable);

  if (hasStatus) {
    const { data, error: e } = await supabase
      .schema('indoor')
      .from(table)
      .update({ status: 'archived', updated_by: user.id })
      .eq('id', id)
      .select()
      .single();
    if (e) return NextResponse.json({ error: e.message }, { status: 400 });
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(data);
  }

  const { error: e } = await supabase.schema('indoor').from(table).delete().eq('id', id);
  if (e) return NextResponse.json({ error: e.message }, { status: 400 });
  return NextResponse.json({ deleted: true });
}
