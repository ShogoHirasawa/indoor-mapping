/**
 * IMDF Export Script (Phase 6)
 *
 * Exports published indoor data from Supabase to IMDF format (zip),
 * uploads to exports bucket, and records in export_jobs.
 *
 * Run: npx tsx scripts/imdf/export-imdf.ts <venue_id> [created_by_user_id]
 * Env: SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
import { createClient } from '@supabase/supabase-js';
import JSZip from 'jszip';

const IMDF_VERSION = '1.0.0';
const DEFAULT_LANGUAGE = 'en';

type GeoJSONPosition = number[];
type GeoJSONPoint = { type: 'Point'; coordinates: GeoJSONPosition };
type GeoJSONLineString = { type: 'LineString'; coordinates: GeoJSONPosition[] };
type GeoJSONPolygon = { type: 'Polygon'; coordinates: GeoJSONPosition[][] };
type GeoJSONMultiPolygon = { type: 'MultiPolygon'; coordinates: GeoJSONPosition[][][] };
type GeoJSONGeometry = GeoJSONPoint | GeoJSONLineString | GeoJSONPolygon | GeoJSONMultiPolygon;

function labelEn(value: string | null | undefined): { en: string } | null {
  if (value == null || value.trim() === '') return null;
  return { en: value.trim() };
}

/** IMDF-style feature (GeoJSON Feature plus optional feature_type). */
function feature(
  id: string,
  feature_type: string,
  geometry: GeoJSONGeometry | null,
  properties: Record<string, unknown>
): GeoJSON.Feature & { feature_type?: string } {
  return {
    type: 'Feature',
    id,
    feature_type,
    geometry: geometry as GeoJSON.Geometry,
    properties,
  };
}

function featureCollection(features: GeoJSON.Feature[]): GeoJSON.FeatureCollection {
  return { type: 'FeatureCollection', features };
}

/** IMDF Opening requires LineString; convert Point or Polygon/MultiPolygon to a tiny segment. */
function openingGeometry(geom: GeoJSONGeometry): GeoJSONLineString {
  if (geom.type === 'LineString' && geom.coordinates.length >= 2) {
    return geom;
  }
  if (geom.type === 'Point') {
    const [x, y] = geom.coordinates;
    return { type: 'LineString', coordinates: [[x, y], [x + 1e-7, y]] };
  }
  const firstPoint =
    geom.type === 'Polygon'
      ? geom.coordinates[0][0]
      : (geom as GeoJSONMultiPolygon).coordinates[0][0][0];
  const [x, y] = firstPoint;
  return { type: 'LineString', coordinates: [[x, y], [x + 1e-7, y]] };
}

/** Map our space_type to IMDF unit category. */
function unitCategory(spaceType: string): string {
  const m: Record<string, string> = {
    room: 'room',
    corridor: 'corridor',
    lobby: 'lobby',
    unit: 'unit',
    section: 'section',
  };
  return m[spaceType?.toLowerCase()] ?? 'room';
}

/** Map our opening_type to IMDF opening category. */
function openingCategory(openingType: string): string {
  const m: Record<string, string> = {
    entrance: 'pedestrian.principal',
    door: 'pedestrian',
    gate: 'pedestrian',
  };
  return m[openingType?.toLowerCase()] ?? 'pedestrian';
}

/** Map our amenity_type to IMDF amenity category. */
function amenityCategory(amenityType: string): string {
  const m: Record<string, string> = {
    restroom: 'restroom',
    toilet: 'restroom',
    atm: 'atm',
    info: 'information',
    information: 'information',
  };
  return m[amenityType?.toLowerCase()] ?? 'unspecified';
}

/** Map our occupant category to IMDF occupant category. */
function occupantCategory(cat: string | null | undefined): string {
  if (!cat) return 'unspecified';
  const m: Record<string, string> = {
    restaurant: 'restaurant',
    retail: 'retail',
    shop: 'retail',
    office: 'office',
  };
  return m[cat.toLowerCase()] ?? 'unspecified';
}

export async function exportImdf(
  venueId: string,
  options?: { createdBy?: string }
): Promise<{ jobId: string; attachmentId: string; path: string }> {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY and (SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL) are required. Set in .env and run from project root.'
    );
  }
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  // Resolve venue + organization for job and path (RPC returns these)
  const { data: venueRow, error: venueError } = await supabase
    .schema('indoor')
    .from('venues')
    .select('id, organization_id')
    .eq('id', venueId)
    .eq('status', 'published')
    .single();
  if (venueError) {
    console.error('Venue query error:', venueError);
    throw new Error(`Venue query failed: ${venueError.message}`);
  }
  if (!venueRow) throw new Error('Venue not found or not published');

  const { data: jobRow, error: jobInsertError } = await supabase
    .schema('indoor')
    .from('export_jobs')
    .insert({
      organization_id: venueRow.organization_id,
      venue_id: venueId,
      format_type: 'imdf',
      output_attachment_id: null,
      job_status: 'pending',
      result_summary_json: null,
      error_message: null,
      created_by: options?.createdBy ?? null,
    })
    .select('id')
    .single();
  if (jobInsertError) throw new Error(`Export job create failed: ${jobInsertError.message}`);
  const jobId = jobRow.id;

  const { data: payload, error: rpcError } = await supabase
    .schema('indoor')
    .rpc('get_imdf_export_data', { p_venue_id: venueId });

  if (rpcError) {
    await supabase
      .schema('indoor')
      .from('export_jobs')
      .update({ job_status: 'failed', error_message: rpcError.message })
      .eq('id', jobId);
    throw new Error(`RPC failed: ${rpcError.message}`);
  }
  if (payload == null) {
    console.error('RPC get_imdf_export_data returned null (venue not found or not published in DB function)');
    await supabase
      .schema('indoor')
      .from('export_jobs')
      .update({ job_status: 'failed', error_message: 'Venue not found or not published' })
      .eq('id', jobId);
    throw new Error('Venue not found or not published');
  }

  const venue = payload.venue as {
    id: string;
    name: string;
    category: string | null;
    address: string | null;
    organization_id: string;
    geometry: GeoJSONGeometry;
  };
  const address = payload.address as { id: string; address: string; locality: string; country: string };
  const buildings = (payload.buildings ?? []) as Array<{
    id: string;
    name: string;
    external_id: string | null;
    footprint_geom: GeoJSONGeometry | null;
    display_point: GeoJSONPoint | null;
  }>;
  const levels = (payload.levels ?? []) as Array<{
    id: string;
    building_id: string;
    name: string;
    ordinal: number;
    short_name: string | null;
    geometry: GeoJSONGeometry;
    display_point: GeoJSONPoint | null;
  }>;
  const spaces = (payload.spaces ?? []) as Array<{
    id: string;
    level_id: string;
    building_id: string;
    name: string | null;
    space_type: string;
    accessibility_type: string | null;
    geometry: GeoJSONGeometry;
    display_point: GeoJSONPoint | null;
  }>;
  const openings = (payload.openings ?? []) as Array<{
    id: string;
    level_id: string;
    name: string | null;
    opening_type: string;
    geometry: GeoJSONGeometry;
  }>;
  const amenities = (payload.amenities ?? []) as Array<{
    id: string;
    level_id: string;
    name: string | null;
    amenity_type: string;
    geometry: GeoJSONPoint;
  }>;
  const occupants = (payload.occupants ?? []) as Array<{
    id: string;
    name: string;
    category: string | null;
    related_space_id: string | null;
    level_id: string;
  }>;
  const anchors = (payload.anchors ?? []) as Array<{
    id: string;
    occupant_id: string;
    unit_id: string;
    geometry: GeoJSONPoint | null;
  }>;

  const anchorByOccupantId = new Map(anchors.map((a) => [a.occupant_id, a]));

  const zip = new JSZip();

  zip.file(
    'manifest.json',
    JSON.stringify(
      {
        version: IMDF_VERSION,
        created: new Date().toISOString().replace(/\.\d{3}Z$/, ''),
        generated_by: 'indoor-mapping export-imdf',
        language: DEFAULT_LANGUAGE,
        extensions: null,
      },
      null,
      2
    )
  );

  zip.file(
    'address.geojson',
    JSON.stringify(
      featureCollection([
        feature(address.id, 'address', null, {
          address: address.address || venue.name,
          unit: null,
          locality: address.locality,
          province: null,
          country: address.country,
          postal_code: null,
        } as Record<string, unknown>),
      ]),
      null,
      2
    )
  );

  const venueDisplayPoint =
    venue.geometry?.type === 'Point'
      ? venue.geometry
      : venue.geometry?.type === 'Polygon'
        ? { type: 'Point' as const, coordinates: venue.geometry.coordinates[0][0] }
        : venue.geometry?.type === 'MultiPolygon'
          ? { type: 'Point' as const, coordinates: venue.geometry.coordinates[0][0][0] }
          : null;

  zip.file(
    'venue.geojson',
    JSON.stringify(
      featureCollection([
        feature(venue.id, 'venue', venue.geometry, {
          category: venue.category ?? 'unspecified',
          restriction: null,
          name: labelEn(venue.name) ?? { en: venue.name },
          alt_name: null,
          hours: null,
          phone: null,
          website: null,
          display_point: venueDisplayPoint ?? { type: 'Point', coordinates: [0, 0] },
          address_id: address.id,
        }),
      ]),
      null,
      2
    )
  );

  if (buildings.length > 0) {
    zip.file(
      'building.geojson',
      JSON.stringify(
        featureCollection(
          buildings.map((b) =>
            feature(b.id, 'building', null, {
              name: labelEn(b.name),
              alt_name: null,
              category: 'building',
              restriction: null,
              display_point: b.display_point ?? { type: 'Point', coordinates: [0, 0] },
              address_id: address.id,
            })
          )
        ),
        null,
        2
      )
    );
  }

  if (levels.length > 0) {
    zip.file(
      'level.geojson',
      JSON.stringify(
        featureCollection(
          levels.map((l) =>
            feature(l.id, 'level', l.geometry, {
              category: 'floor',
              restriction: null,
              ordinal: l.ordinal,
              outdoor: false,
              name: labelEn(l.name) ?? { en: l.name },
              short_name: labelEn(l.short_name ?? l.name) ?? { en: String(l.ordinal) },
              display_point: l.display_point ?? null,
              address_id: null,
              building_ids: [l.building_id],
            })
          )
        ),
        null,
        2
      )
    );
  }

  if (spaces.length > 0) {
    zip.file(
      'unit.geojson',
      JSON.stringify(
        featureCollection(
          spaces.map((s) =>
            feature(s.id, 'unit', s.geometry, {
              category: unitCategory(s.space_type),
              restriction: null,
              accessibility: s.accessibility_type ? [s.accessibility_type] : null,
              name: labelEn(s.name ?? undefined),
              alt_name: null,
              level_id: s.level_id,
              display_point: s.display_point ?? null,
            })
          )
        ),
        null,
        2
      )
    );
  }

  if (openings.length > 0) {
    zip.file(
      'opening.geojson',
      JSON.stringify(
        featureCollection(
          openings.map((o) =>
            feature(o.id, 'opening', openingGeometry(o.geometry), {
              category: openingCategory(o.opening_type),
              accessibility: null,
              access_control: null,
              door: null,
              name: labelEn(o.name ?? undefined),
              alt_name: null,
              display_point: null,
              level_id: o.level_id,
            })
          )
        ),
        null,
        2
      )
    );
  }

  if (amenities.length > 0) {
    zip.file(
      'amenity.geojson',
      JSON.stringify(
        featureCollection(
          amenities.map((a) => {
            const unitIds = spaces.filter((s) => s.level_id === a.level_id).map((s) => s.id);
            return feature(a.id, 'amenity', a.geometry, {
              category: amenityCategory(a.amenity_type),
              accessibility: null,
              name: labelEn(a.name ?? undefined),
              alt_name: null,
              hours: null,
              phone: null,
              website: null,
              unit_ids: unitIds.length ? unitIds : [spaces[0]?.id].filter(Boolean),
              address_id: null,
              correlation_id: null,
            });
          })
        ),
        null,
        2
      )
    );
  }

  const validAnchors = anchors.filter((a) => a.geometry != null);
  if (validAnchors.length > 0) {
    zip.file(
      'anchor.geojson',
      JSON.stringify(
        featureCollection(
          validAnchors.map((a) =>
            feature(a.id, 'anchor', a.geometry!, {
              address_id: null,
              unit_id: a.unit_id,
            })
          )
        ),
        null,
        2
      )
    );
  }

  const occupantsWithAnchor = occupants.filter((o) => anchorByOccupantId.has(o.id));
  if (occupantsWithAnchor.length > 0) {
    zip.file(
      'occupant.geojson',
      JSON.stringify(
        featureCollection(
          occupantsWithAnchor.map((o) => {
            const anchor = anchorByOccupantId.get(o.id)!;
            return feature(o.id, 'occupant', null, {
              category: occupantCategory(o.category),
              name: labelEn(o.name) ?? { en: o.name },
              phone: null,
              website: null,
              hours: null,
              validity: null,
              anchor_id: anchor.id,
              correlation_id: null,
            });
          })
        ),
        null,
        2
      )
    );
  }

  const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
  const objectPath = `${venue.organization_id}/${venueId}/${jobId}.zip`;

  const { error: uploadError } = await supabase.storage.from('exports').upload(objectPath, zipBuffer, {
    contentType: 'application/zip',
    upsert: true,
  });
  if (uploadError) {
    await supabase
      .schema('indoor')
      .from('export_jobs')
      .update({ job_status: 'failed', error_message: `Storage upload failed: ${uploadError.message}` })
      .eq('id', jobId);
    throw new Error(`Storage upload failed: ${uploadError.message}`);
  }

  const { data: attachment, error: attError } = await supabase
    .schema('indoor')
    .from('attachments')
    .insert({
      organization_id: venue.organization_id,
      venue_id: venueId,
      attachment_type: 'imdf_zip',
      bucket_name: 'exports',
      object_path: objectPath,
      mime_type: 'application/zip',
      file_size_bytes: zipBuffer.length,
      uploaded_by: options?.createdBy ?? null,
    })
    .select('id')
    .single();

  if (attError) {
    await supabase
      .schema('indoor')
      .from('export_jobs')
      .update({ job_status: 'failed', error_message: `Attachment insert failed: ${attError.message}` })
      .eq('id', jobId);
    throw new Error(`Attachment insert failed: ${attError.message}`);
  }

  const { error: jobUpdateError } = await supabase
    .schema('indoor')
    .from('export_jobs')
    .update({
      output_attachment_id: attachment.id,
      job_status: 'succeeded',
      result_summary_json: {
        venue_id: venueId,
        buildings: buildings.length,
        levels: levels.length,
        spaces: spaces.length,
        openings: openings.length,
        amenities: amenities.length,
        occupants: occupantsWithAnchor.length,
      },
      error_message: null,
    })
    .eq('id', jobId);

  if (jobUpdateError) throw new Error(`Export job update failed: ${jobUpdateError.message}`);

  return { jobId, attachmentId: attachment.id, path: objectPath };
}

async function main() {
  const venueId = process.argv[2];
  const createdBy = process.argv[3] ?? undefined;
  if (!venueId) {
    console.error('Usage: npx tsx scripts/imdf/export-imdf.ts <venue_id> [created_by_user_id]');
    process.exit(1);
  }
  try {
    const result = await exportImdf(venueId, { createdBy });
    console.log('Export succeeded:', result);
  } catch (e) {
    console.error('Export failed:', e instanceof Error ? e.message : e);
    process.exit(1);
  }
}

main();
