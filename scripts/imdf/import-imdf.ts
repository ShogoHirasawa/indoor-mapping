/**
 * IMDF Import Script (Phase 7)
 *
 * Imports IMDF zip into Supabase indoor schema.
 * - Reads zip from local path or from Storage (attachment_id)
 * - Creates source_record (source_type = 'imdf_import'), import_job
 * - Maps venue, building, level, unit, opening, amenity, occupant into indoor tables
 *
 * Run: npx tsx scripts/imdf/import-imdf.ts <organization_id> <path_or_attachment_id> [created_by]
 * Env: SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import JSZip from 'jszip';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type GeoJSONPoint = { type: 'Point'; coordinates: number[] };
type GeoJSONLineString = { type: 'LineString'; coordinates: number[][] };
type GeoJSONPolygon = { type: 'Polygon'; coordinates: number[][][] };
type GeoJSONMultiPolygon = { type: 'MultiPolygon'; coordinates: number[][][][] };
type GeoJSONGeometry = GeoJSONPoint | GeoJSONLineString | GeoJSONPolygon | GeoJSONMultiPolygon;

/** Convert GeoJSON geometry to WKT for Supabase PostGIS insert (SRID 4326). */
function geojsonToWkt(geom: GeoJSONGeometry): string {
  if (geom.type === 'Point') {
    const [lng, lat] = geom.coordinates;
    return `SRID=4326;POINT(${lng} ${lat})`;
  }
  if (geom.type === 'LineString') {
    const pts = geom.coordinates.map((c) => `${c[0]} ${c[1]}`).join(', ');
    return `SRID=4326;LINESTRING(${pts})`;
  }
  if (geom.type === 'Polygon') {
    const rings = geom.coordinates.map((ring) => `(${ring.map((c) => `${c[0]} ${c[1]}`).join(', ')})`);
    return `SRID=4326;POLYGON(${rings.join(', ')})`;
  }
  if (geom.type === 'MultiPolygon') {
    const polys = geom.coordinates.map(
      (poly) => `((${poly[0].map((c) => `${c[0]} ${c[1]}`).join(', ')}))`
    );
    return `SRID=4326;MULTIPOLYGON(${polys.join(', ')})`;
  }
  throw new Error(`Unsupported geometry type: ${(geom as { type: string }).type}`);
}

/** Get first label from IMDF LABELS (e.g. { en: "Name" } -> "Name"). */
function labelToText(labels: Record<string, string> | null | undefined): string | null {
  if (labels == null || typeof labels !== 'object') return null;
  const v = labels.en ?? labels['en-US'] ?? Object.values(labels)[0];
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

/** Reverse: IMDF unit category -> our space_type. */
function unitCategoryToSpaceType(category: string): string {
  const m: Record<string, string> = {
    room: 'room',
    corridor: 'corridor',
    lobby: 'lobby',
    unit: 'unit',
    section: 'section',
  };
  return m[category?.toLowerCase()] ?? 'room';
}

/** Reverse: IMDF opening category -> our opening_type. */
function openingCategoryToType(category: string): string {
  const m: Record<string, string> = {
    'pedestrian.principal': 'entrance',
    pedestrian: 'door',
    door: 'door',
    gate: 'gate',
  };
  return m[category?.toLowerCase()] ?? 'door';
}

/** Reverse: IMDF amenity category -> our amenity_type. */
function amenityCategoryToType(category: string): string {
  const m: Record<string, string> = {
    restroom: 'restroom',
    toilet: 'restroom',
    atm: 'atm',
    information: 'info',
  };
  return m[category?.toLowerCase()] ?? 'unspecified';
}

/** Reverse: IMDF occupant category -> our category. */
function occupantCategoryToCategory(cat: string): string {
  const m: Record<string, string> = {
    restaurant: 'restaurant',
    retail: 'retail',
    office: 'office',
  };
  return m[cat?.toLowerCase()] ?? 'unspecified';
}

export interface ImportImdfOptions {
  organizationId: string;
  /** Local file path to .zip or Supabase attachment UUID (zip in Storage). */
  inputPathOrAttachmentId: string;
  createdBy?: string;
}

export interface ImportImdfResult {
  jobId: string;
  venueId: string;
  attachmentId: string;
  summary: { venues: number; buildings: number; levels: number; spaces: number; openings: number; amenities: number; occupants: number };
}

export async function importImdf(options: ImportImdfOptions): Promise<ImportImdfResult> {
  const { organizationId, inputPathOrAttachmentId, createdBy } = options;
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY and (SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL) are required.'
    );
  }
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  let zipBuffer: Buffer;
  let inputAttachmentId: string;

  if (UUID_REGEX.test(inputPathOrAttachmentId.trim())) {
    const attachmentId = inputPathOrAttachmentId.trim();
    const { data: att, error: attErr } = await supabase
      .schema('indoor')
      .from('attachments')
      .select('id, bucket_name, object_path')
      .eq('id', attachmentId)
      .single();
    if (attErr || !att) throw new Error(`Attachment not found: ${attachmentId}`);
    const { data: blob, error: downErr } = await supabase.storage
      .from(att.bucket_name)
      .download(att.object_path);
    if (downErr || !blob) throw new Error(`Failed to download: ${downErr?.message ?? 'no data'}`);
    zipBuffer = Buffer.from(await blob.arrayBuffer());
    inputAttachmentId = att.id;
  } else {
    const localPath = path.resolve(process.cwd(), inputPathOrAttachmentId);
    if (!fs.existsSync(localPath)) throw new Error(`File not found: ${localPath}`);
    zipBuffer = fs.readFileSync(localPath);
    const objectPath = `${organizationId}/imports/${Date.now()}-${path.basename(localPath)}`;
    const { error: uploadErr } = await supabase.storage.from('imports').upload(objectPath, zipBuffer, {
      contentType: 'application/zip',
      upsert: true,
    });
    if (uploadErr) throw new Error(`Upload to Storage failed: ${uploadErr.message}`);
    const { data: newAtt, error: insErr } = await supabase
      .schema('indoor')
      .from('attachments')
      .insert({
        organization_id: organizationId,
        attachment_type: 'imdf_zip',
        bucket_name: 'imports',
        object_path: objectPath,
        mime_type: 'application/zip',
        file_size_bytes: zipBuffer.length,
        uploaded_by: createdBy ?? null,
      })
      .select('id')
      .single();
    if (insErr || !newAtt) throw new Error(`Attachment insert failed: ${insErr?.message}`);
    inputAttachmentId = newAtt.id;
  }

  const zip = await JSZip.loadAsync(zipBuffer);
  const manifestFile = zip.file('manifest.json');
  const venueFile = zip.file('venue.geojson');
  const addressFile = zip.file('address.geojson');
  if (!manifestFile || !venueFile || !addressFile) {
    throw new Error('Invalid IMDF zip: missing manifest.json, venue.geojson, or address.geojson');
  }
  const manifest = JSON.parse(await manifestFile.async('string'));
  const venueFc = JSON.parse(await venueFile.async('string'));
  const addressFc = JSON.parse(await addressFile.async('string'));
  if (!venueFc.features?.length || !addressFc.features?.length) {
    throw new Error('Invalid IMDF: venue.geojson or address.geojson has no features');
  }
  const venueFeature = venueFc.features[0];
  const addressFeature = addressFc.features[0];
  if (venueFeature.feature_type !== 'venue' || addressFeature.feature_type !== 'address') {
    throw new Error('Invalid IMDF: expected venue and address feature types');
  }

  const sourceRecord = await (async () => {
    const { data: sr, error: e } = await supabase
      .schema('indoor')
      .from('source_records')
      .insert({
        source_type: 'imdf_import',
        source_uri: `import_job/${organizationId}`,
        note: `IMDF import ${manifest?.version ?? '?'} ${new Date().toISOString()}`,
        created_by: createdBy ?? null,
      })
      .select('id')
      .single();
    if (e || !sr) throw new Error(`source_record insert failed: ${e?.message}`);
    return sr.id;
  })();

  const jobId = crypto.randomUUID();
  const { error: jobErr } = await supabase
    .schema('indoor')
    .from('import_jobs')
    .insert({
      id: jobId,
      organization_id: organizationId,
      venue_id: null,
      input_attachment_id: inputAttachmentId,
      format_type: 'imdf',
      job_status: 'running',
      result_summary_json: null,
      error_message: null,
      created_by: createdBy ?? null,
    });
  if (jobErr) throw new Error(`import_jobs insert failed: ${jobErr.message}`);

  const idMap = new Map<string, string>();
  const newId = () => {
    const id = crypto.randomUUID();
    return id;
  };

  try {
    const venueId = newId();
    idMap.set(venueFeature.id, venueId);
    const venueName = labelToText(venueFeature.properties?.name as Record<string, string>) ?? 'Imported Venue';
    const addressProps = addressFeature.properties as Record<string, unknown>;
    const addressText = [addressProps?.address, addressProps?.locality, addressProps?.country]
      .filter(Boolean)
      .join(', ') || venueName;

    const { error: vErr } = await supabase.schema('indoor').from('venues').insert({
      id: venueId,
      organization_id: organizationId,
      name: venueName,
      category: (venueFeature.properties?.category as string) ?? null,
      address: addressText || null,
      status: 'draft',
      source_record_id: sourceRecord,
      created_by: createdBy ?? null,
      updated_by: createdBy ?? null,
    });
    if (vErr) throw new Error(`venue insert failed: ${vErr.message}`);

    const buildingFile = zip.file('building.geojson');
    let buildings = buildingFile
      ? (JSON.parse(await buildingFile.async('string')) as GeoJSON.FeatureCollection).features ?? []
      : [];

    const levelFile = zip.file('level.geojson');
    const levels = levelFile
      ? (JSON.parse(await levelFile.async('string')) as GeoJSON.FeatureCollection).features ?? []
      : [];

    const levelBuildingIds = new Set<string>();
    for (const f of levels) {
      const bids = (f.properties?.building_ids as string[]) ?? [];
      bids.forEach((id: string) => levelBuildingIds.add(id));
    }
    if (levels.length > 0 && buildings.length === 0 && levelBuildingIds.size > 0) {
      buildings = levelBuildingIds.size
        ? [{ id: Array.from(levelBuildingIds)[0], properties: { name: { en: 'Building' } } } as unknown as GeoJSON.Feature]
        : [];
    }

    for (const f of buildings) {
      const bid = newId();
      idMap.set(String(f.id ?? ''), bid);
      const name = labelToText(f.properties?.name as Record<string, string>) ?? 'Building';
      await supabase.schema('indoor').from('buildings').insert({
        id: bid,
        venue_id: venueId,
        name,
        external_id: f.id,
        footprint_geom: null,
        status: 'draft',
        source_record_id: sourceRecord,
        created_by: createdBy ?? null,
        updated_by: createdBy ?? null,
      });
    }

    const levelToBuilding = new Map<string, string>();
    for (const f of levels) {
      const lid = newId();
      idMap.set(String(f.id ?? ''), lid);
      const buildingIds = (f.properties?.building_ids as string[]) ?? [];
      const firstBuildingId = buildingIds[0];
      const ourBuildingId = firstBuildingId ? idMap.get(firstBuildingId) : buildings[0] ? idMap.get(String(buildings[0].id ?? '')) : null;
      if (!ourBuildingId) throw new Error('Level has no building_id mapping');
      levelToBuilding.set(lid, ourBuildingId);
      const name = labelToText(f.properties?.name as Record<string, string>) ?? String(f.properties?.ordinal ?? '');
      await supabase.schema('indoor').from('levels').insert({
        id: lid,
        building_id: ourBuildingId,
        name,
        ordinal: (f.properties?.ordinal as number) ?? 0,
        short_name: labelToText(f.properties?.short_name as Record<string, string>) ?? null,
        status: 'draft',
        created_by: createdBy ?? null,
        updated_by: createdBy ?? null,
      });
    }

    const unitFile = zip.file('unit.geojson');
    const units = unitFile
      ? (JSON.parse(await unitFile.async('string')) as GeoJSON.FeatureCollection).features ?? []
      : [];
    for (const f of units) {
      const sid = newId();
      idMap.set(String(f.id ?? ''), sid);
      const levelId = idMap.get(f.properties?.level_id as string);
      if (!levelId) throw new Error(`Unit ${f.id} has unknown level_id`);
      const buildingId = levelToBuilding.get(levelId);
      if (!buildingId) throw new Error(`No building for level ${levelId}`);
      const geom = f.geometry as GeoJSONGeometry;
      if (!geom || (geom.type !== 'Polygon' && geom.type !== 'MultiPolygon')) {
        throw new Error(`Unit ${f.id} has invalid geometry`);
      }
      const { error: sErr } = await supabase.schema('indoor').from('spaces').insert({
        id: sid,
        level_id: levelId,
        building_id: buildingId,
        venue_id: venueId,
        name: labelToText(f.properties?.name as Record<string, string>) ?? null,
        space_type: unitCategoryToSpaceType((f.properties?.category as string) ?? 'room'),
        geom: geojsonToWkt(geom),
        accessibility_type: Array.isArray(f.properties?.accessibility) ? (f.properties.accessibility[0] as string) : null,
        status: 'draft',
        source_record_id: sourceRecord,
        created_by: createdBy ?? null,
        updated_by: createdBy ?? null,
      });
      if (sErr) throw new Error(`space insert failed: ${sErr.message}`);
    }

    const openingFile = zip.file('opening.geojson');
    const openings = openingFile
      ? (JSON.parse(await openingFile.async('string')) as GeoJSON.FeatureCollection).features ?? []
      : [];
    for (const f of openings) {
      const oid = newId();
      const levelId = idMap.get(f.properties?.level_id as string);
      if (!levelId) continue;
      const buildingId = levelToBuilding.get(levelId);
      if (!buildingId) continue;
      const geom = f.geometry as GeoJSONGeometry;
      if (!geom) continue;
      const wkt =
        geom.type === 'Point'
          ? geojsonToWkt(geom)
          : geom.type === 'LineString'
            ? geojsonToWkt(geom)
            : null;
      if (!wkt) continue;
      await supabase.schema('indoor').from('openings').insert({
        id: oid,
        level_id: levelId,
        building_id: buildingId,
        venue_id: venueId,
        name: labelToText(f.properties?.name as Record<string, string>) ?? null,
        opening_type: openingCategoryToType((f.properties?.category as string) ?? 'pedestrian'),
        geom: wkt,
        status: 'draft',
        source_record_id: sourceRecord,
        created_by: createdBy ?? null,
        updated_by: createdBy ?? null,
      });
    }

    const amenityFile = zip.file('amenity.geojson');
    const amenities = amenityFile
      ? (JSON.parse(await amenityFile.async('string')) as GeoJSON.FeatureCollection).features ?? []
      : [];
    for (const f of amenities) {
      const aid = newId();
      let levelId: string | undefined;
      const unitIds = f.properties?.unit_ids as string[] | undefined;
      if (unitIds?.[0]) {
        const u = units.find((u) => String(u.id ?? '') === unitIds![0]);
        const imdfLevelId = u?.properties?.level_id as string | undefined;
        levelId = imdfLevelId ? idMap.get(imdfLevelId) : undefined;
      }
      if (!levelId && levels[0]) levelId = idMap.get(String(levels[0].id ?? ''));
      if (!levelId) continue;
      const buildingId = levelToBuilding.get(levelId);
      if (!buildingId) continue;
      const geom = f.geometry as GeoJSONPoint;
      if (!geom || geom.type !== 'Point') continue;
      await supabase.schema('indoor').from('amenities').insert({
        id: aid,
        level_id: levelId,
        building_id: buildingId,
        venue_id: venueId,
        amenity_type: amenityCategoryToType((f.properties?.category as string) ?? 'unspecified'),
        name: labelToText(f.properties?.name as Record<string, string>) ?? null,
        geom: geojsonToWkt(geom),
        status: 'draft',
        created_by: createdBy ?? null,
        updated_by: createdBy ?? null,
      });
    }

    const anchorFile = zip.file('anchor.geojson');
    const anchors = anchorFile
      ? (JSON.parse(await anchorFile.async('string')) as GeoJSON.FeatureCollection).features ?? []
      : [];
    const anchorToUnitId = new Map<string, string>();
    for (const f of anchors) {
      const unitId = f.properties?.unit_id as string;
      if (unitId) anchorToUnitId.set(String(f.id ?? ''), idMap.get(unitId) ?? unitId);
    }

    const occupantFile = zip.file('occupant.geojson');
    const occupants = occupantFile
      ? (JSON.parse(await occupantFile.async('string')) as GeoJSON.FeatureCollection).features ?? []
      : [];
    for (const f of occupants) {
      const occId = newId();
      const anchorId = f.properties?.anchor_id as string;
      const relatedSpaceId = anchorId ? anchorToUnitId.get(anchorId) : null;
      const levelId = relatedSpaceId
        ? (() => {
            const u = units.find((u) => idMap.get(String(u.id ?? '')) === relatedSpaceId);
            return u ? idMap.get(String(u.properties?.level_id ?? '')) : levels[0] ? idMap.get(String(levels[0].id ?? '')) : null;
          })()
        : levels[0] ? idMap.get(String(levels[0].id ?? '')) : null;
      if (!levelId) continue;
      const buildingId = levelToBuilding.get(levelId);
      if (!buildingId) continue;
      await supabase.schema('indoor').from('occupants').insert({
        id: occId,
        level_id: levelId,
        building_id: buildingId,
        venue_id: venueId,
        name: labelToText(f.properties?.name as Record<string, string>) ?? 'Occupant',
        category: occupantCategoryToCategory(f.properties?.category as string),
        related_space_id: relatedSpaceId ?? null,
        status: 'draft',
        created_by: createdBy ?? null,
        updated_by: createdBy ?? null,
      });
    }

    const summary = {
      venues: 1,
      buildings: buildings.length,
      levels: levels.length,
      spaces: units.length,
      openings: openings.length,
      amenities: amenities.length,
      occupants: occupants.length,
    };

    const { error: updateErr } = await supabase
      .schema('indoor')
      .from('import_jobs')
      .update({
        venue_id: venueId,
        job_status: 'succeeded',
        result_summary_json: summary,
        error_message: null,
      })
      .eq('id', jobId);
    if (updateErr) throw new Error(`import_jobs update failed: ${updateErr.message}`);

    return {
      jobId,
      venueId,
      attachmentId: inputAttachmentId,
      summary,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await supabase
      .schema('indoor')
      .from('import_jobs')
      .update({ job_status: 'failed', error_message: msg })
      .eq('id', jobId);
    const venueIdForDelete = idMap.get(venueFeature.id);
    if (venueIdForDelete) {
      await supabase.schema('indoor').from('venues').delete().eq('id', venueIdForDelete);
    }
    throw err;
  }
}

async function main() {
  const organizationId = process.argv[2];
  const input = process.argv[3];
  const createdBy = process.argv[4];
  if (!organizationId || !input) {
    console.error(
      'Usage: npx tsx scripts/imdf/import-imdf.ts <organization_id> <path_or_attachment_id> [created_by]'
    );
    process.exit(1);
  }
  try {
    const result = await importImdf({
      organizationId,
      inputPathOrAttachmentId: input,
      createdBy,
    });
    console.log('Import succeeded:', result);
  } catch (e) {
    console.error('Import failed:', e instanceof Error ? e.message : e);
    process.exit(1);
  }
}

main();
