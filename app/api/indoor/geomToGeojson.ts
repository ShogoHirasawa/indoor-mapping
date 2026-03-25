import wkx from 'wkx';

/** Convert PostGIS WKB (hex string) to GeoJSON for API responses. */
export function wkbHexToGeojson(hex: unknown): unknown {
  if (typeof hex !== 'string' || !/^[0-9a-fA-F]+$/.test(hex)) return hex;
  try {
    const buf = Buffer.from(hex, 'hex');
    const geom = wkx.Geometry.parse(buf);
    return geom.toGeoJSON();
  } catch {
    return hex;
  }
}

const GEOM_COLUMNS: Record<string, string[]> = {
  buildings: ['footprint_geom'],
  spaces: ['geom'],
  openings: ['geom'],
  vertical_connectors: ['geom'],
  amenities: ['geom'],
  routing_nodes: ['geom'],
  routing_edges: ['geom'],
};

/** Map each row: convert geometry columns from WKB hex to GeoJSON. */
export function mapRowsGeomToGeojson(table: string, rows: unknown[]): unknown[] {
  const cols = GEOM_COLUMNS[table];
  if (!cols || !Array.isArray(rows)) return rows;
  return rows.map((row) => {
    if (typeof row !== 'object' || row === null) return row;
    const out = { ...(row as Record<string, unknown>) };
    for (const col of cols) {
      if (col in out) (out as Record<string, unknown>)[col] = wkbHexToGeojson(out[col]);
    }
    return out;
  });
}
