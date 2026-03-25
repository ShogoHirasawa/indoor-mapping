import type { Geometry } from 'geojson';

/**
 * Convert GeoJSON geometry to WKT for PostGIS (SRID 4326).
 * Used when sending geom to the indoor API.
 */
export function geometryToWkt(geom: Geometry): string {
  if (geom.type === 'Point') {
    const [lng, lat] = geom.coordinates as [number, number];
    return `SRID=4326;POINT(${lng} ${lat})`;
  }
  if (geom.type === 'LineString') {
    const pts = (geom.coordinates as [number, number][]).map((c) => `${c[0]} ${c[1]}`).join(', ');
    return `SRID=4326;LINESTRING(${pts})`;
  }
  if (geom.type === 'Polygon') {
    const rings = (geom.coordinates as [number, number][][])
      .map((ring) => `(${ring.map((c) => `${c[0]} ${c[1]}`).join(', ')})`);
    return `SRID=4326;POLYGON(${rings.join(', ')})`;
  }
  if (geom.type === 'MultiPolygon') {
    const polys = (geom.coordinates as [number, number][][][])
      .map((poly) => `((${poly[0].map((c) => `${c[0]} ${c[1]}`).join(', ')}))`);
    return `SRID=4326;MULTIPOLYGON(${polys.join(', ')})`;
  }
  throw new Error(`Unsupported geometry type: ${(geom as { type: string }).type}`);
}

/** Convert Polygon to MultiPolygon WKT (for footprint_geom column). */
export function polygonToMultiPolygonWkt(geom: Geometry): string {
  if (geom.type === 'MultiPolygon') return geometryToWkt(geom);
  if (geom.type === 'Polygon') {
    const ring = (geom.coordinates as [number, number][][])[0];
    const pts = ring.map((c) => `${c[0]} ${c[1]}`).join(', ');
    return `SRID=4326;MULTIPOLYGON(((${pts})))`;
  }
  throw new Error('footprint must be Polygon or MultiPolygon');
}
