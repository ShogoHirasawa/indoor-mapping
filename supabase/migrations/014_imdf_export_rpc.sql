-- RPC: return published venue data as JSON for IMDF export (GeoJSON for all geometries)
-- Called by scripts/imdf/export-imdf.ts with service role

CREATE OR REPLACE FUNCTION indoor.get_imdf_export_data(p_venue_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = indoor, extensions, public
AS $$
DECLARE
  v_venue record;
  v_venue_geom json;
  v_address_id uuid;
  v_result jsonb;
BEGIN
  -- Venue must exist and be published
  SELECT id, name, category, address, organization_id
  INTO v_venue
  FROM indoor.venues
  WHERE id = p_venue_id AND status = 'published';
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Venue extent: union of published building footprints, else union of space geoms, else tiny buffer at origin
  SELECT COALESCE(
    (SELECT ST_AsGeoJSON(g)::json FROM (
      SELECT ST_Union(b.footprint_geom) AS g
      FROM indoor.buildings b
      WHERE b.venue_id = p_venue_id AND b.status = 'published' AND b.footprint_geom IS NOT NULL
    ) s WHERE s.g IS NOT NULL),
    (SELECT ST_AsGeoJSON(ST_Union(s.geom))::json FROM indoor.spaces s WHERE s.venue_id = p_venue_id AND s.status = 'published'),
    ST_AsGeoJSON(ST_Buffer(ST_SetSRID(ST_MakePoint(0, 0), 4326), 0.0001))::json
  ) INTO v_venue_geom;

  -- Single address ID for venue (we use one address per venue from venue.address)
  v_address_id := gen_random_uuid();

  v_result := jsonb_build_object(
    'venue', jsonb_build_object(
      'id', v_venue.id,
      'name', v_venue.name,
      'category', v_venue.category,
      'address', v_venue.address,
      'organization_id', v_venue.organization_id,
      'geometry', v_venue_geom
    ),
    'address', jsonb_build_object(
      'id', v_address_id,
      'address', COALESCE(v_venue.address, v_venue.name),
      'locality', 'Unknown',
      'country', 'XX'
    ),
    'buildings', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'id', b.id, 'venue_id', b.venue_id, 'name', b.name, 'external_id', b.external_id,
          'footprint_geom', ST_AsGeoJSON(b.footprint_geom)::json,
          'display_point', CASE WHEN b.footprint_geom IS NOT NULL THEN ST_AsGeoJSON(ST_Centroid(b.footprint_geom))::json ELSE NULL END
        ) ORDER BY b.name
      ), '[]'::jsonb)
      FROM indoor.buildings b
      WHERE b.venue_id = p_venue_id AND b.status = 'published'
    ),
    'levels', (
      SELECT COALESCE(jsonb_agg(lev), '[]'::jsonb)
      FROM (
        SELECT jsonb_build_object(
          'id', l.id, 'building_id', l.building_id, 'name', l.name, 'ordinal', l.ordinal, 'short_name', l.short_name,
          'geometry', COALESCE(
            (SELECT ST_AsGeoJSON(ST_Union(s.geom))::json FROM indoor.spaces s WHERE s.level_id = l.id AND s.status = 'published'),
            (SELECT ST_AsGeoJSON(ST_Buffer(ST_SetSRID(ST_MakePoint(0, 0), 4326), 0.0001))::json)
          ),
          'display_point', (SELECT ST_AsGeoJSON(ST_Centroid(ST_Union(s.geom)))::json FROM indoor.spaces s WHERE s.level_id = l.id AND s.status = 'published')
        ) AS lev
        FROM indoor.levels l
        JOIN indoor.buildings b ON b.id = l.building_id AND b.venue_id = p_venue_id AND b.status = 'published'
        WHERE l.status = 'published'
      ) x
    ),
    'spaces', (
      SELECT COALESCE(jsonb_agg(sp), '[]'::jsonb)
      FROM (
        SELECT jsonb_build_object(
          'id', s.id, 'level_id', s.level_id, 'building_id', s.building_id, 'name', s.name, 'space_type', s.space_type, 'accessibility_type', s.accessibility_type,
          'geometry', ST_AsGeoJSON(s.geom)::json,
          'display_point', ST_AsGeoJSON(ST_Centroid(s.geom))::json
        ) AS sp
        FROM indoor.spaces s
        WHERE s.venue_id = p_venue_id AND s.status = 'published'
      ) x
    ),
    'openings', (
      SELECT COALESCE(jsonb_agg(op), '[]'::jsonb)
      FROM (
        SELECT jsonb_build_object(
          'id', o.id, 'level_id', o.level_id, 'name', o.name, 'opening_type', o.opening_type,
          'geometry', ST_AsGeoJSON(o.geom)::json
        ) AS op
        FROM indoor.openings o
        WHERE o.venue_id = p_venue_id AND o.status = 'published'
      ) x
    ),
    'amenities', (
      SELECT COALESCE(jsonb_agg(am), '[]'::jsonb)
      FROM (
        SELECT jsonb_build_object(
          'id', a.id, 'level_id', a.level_id, 'name', a.name, 'amenity_type', a.amenity_type,
          'geometry', ST_AsGeoJSON(a.geom)::json
        ) AS am
        FROM indoor.amenities a
        WHERE a.venue_id = p_venue_id AND a.status = 'published'
      ) x
    ),
    'occupants', (
      SELECT COALESCE(jsonb_agg(occ), '[]'::jsonb)
      FROM (
        SELECT jsonb_build_object(
          'id', o.id, 'name', o.name, 'category', o.category, 'related_space_id', o.related_space_id, 'level_id', o.level_id
        ) AS occ
        FROM indoor.occupants o
        WHERE o.venue_id = p_venue_id AND o.status = 'published'
      ) x
    ),
    'anchors', (
      SELECT COALESCE(jsonb_agg(an), '[]'::jsonb)
      FROM (
        SELECT jsonb_build_object(
          'id', (SELECT gen_random_uuid()),
          'occupant_id', o.id,
          'unit_id', o.related_space_id,
          'geometry', (SELECT ST_AsGeoJSON(ST_Centroid(s.geom))::json FROM indoor.spaces s WHERE s.id = o.related_space_id)
        ) AS an
        FROM indoor.occupants o
        WHERE o.venue_id = p_venue_id AND o.status = 'published' AND o.related_space_id IS NOT NULL
      ) x
    )
  );

  RETURN v_result;
END;
$$;

-- Grant execute to service role and authenticated (script uses service role)
GRANT EXECUTE ON FUNCTION indoor.get_imdf_export_data(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION indoor.get_imdf_export_data(uuid) TO authenticated;
