import type { Position, Geometry, Polygon } from '../types';

/** Generate a simple UUID v4 */
export function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Compute bounding box of a GeoJSON polygon coordinates array.
 * Returns [minLng, minLat, maxLng, maxLat]
 */
export function bboxFromCoords(coords: Position[][]): [number, number, number, number] {
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;
  const ring = coords[0]; // outer ring
  for (const [lng, lat] of ring) {
    if (lng < minLng) minLng = lng;
    if (lat < minLat) minLat = lat;
    if (lng > maxLng) maxLng = lng;
    if (lat > maxLat) maxLat = lat;
  }
  return [minLng, minLat, maxLng, maxLat];
}

/** Compute centroid of a polygon ring */
export function centroid(coords: Position[][]): Position {
  const ring = coords[0];
  let sumLng = 0;
  let sumLat = 0;
  const n = ring.length - 1; // exclude closing point
  for (let i = 0; i < n; i++) {
    sumLng += ring[i][0];
    sumLat += ring[i][1];
  }
  return [sumLng / n, sumLat / n];
}

/** Midpoint of a LineString (2-point) */
export function midpoint(coords: Position[]): Position {
  const [a, b] = coords;
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}

/** Rotate a point around a centre by angle (in degrees) */
export function rotatePoint(point: Position, center: Position, angleDeg: number): Position {
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = point[0] - center[0];
  const dy = point[1] - center[1];
  return [center[0] + dx * cos - dy * sin, center[1] + dx * sin + dy * cos];
}

/**
 * Distance from a point to a line segment [A, B].
 * Returns { distance, nearest } where nearest is the closest point on segment.
 */
export function pointToSegmentDistance(
  p: Position,
  a: Position,
  b: Position,
): { distance: number; nearest: Position } {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) {
    const d = Math.hypot(p[0] - a[0], p[1] - a[1]);
    return { distance: d, nearest: [...a] };
  }
  let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const nearest: Position = [a[0] + t * dx, a[1] + t * dy];
  const d = Math.hypot(p[0] - nearest[0], p[1] - nearest[1]);
  return { distance: d, nearest };
}

/** Create a rectangular polygon centred at [lng, lat] with given width/height offsets */
export function createRectPolygon(
  lng: number,
  lat: number,
  widthOffset: number,
  heightOffset: number,
): Polygon {
  return {
    type: 'Polygon',
    coordinates: [
      [
        [lng - widthOffset, lat - heightOffset],
        [lng + widthOffset, lat - heightOffset],
        [lng + widthOffset, lat + heightOffset],
        [lng - widthOffset, lat + heightOffset],
        [lng - widthOffset, lat - heightOffset], // close ring
      ],
    ],
  };
}

/** Get the centre of any supported geometry */
export function getObjectCenter(geometry: Geometry): Position {
  if (geometry.type === 'Point') {
    return geometry.coordinates as Position;
  } else if (geometry.type === 'LineString') {
    return midpoint(geometry.coordinates as Position[]);
  } else if (geometry.type === 'Polygon') {
    return centroid((geometry as Polygon).coordinates);
  }
  return [0, 0];
}

/** Translate any supported geometry by (dx, dy) */
export function translateGeometry(geometry: Geometry, dx: number, dy: number): Geometry {
  if (geometry.type === 'Point') {
    const c = geometry.coordinates as Position;
    return { type: 'Point', coordinates: [c[0] + dx, c[1] + dy] };
  } else if (geometry.type === 'LineString') {
    return {
      type: 'LineString',
      coordinates: (geometry.coordinates as Position[]).map((c) => [c[0] + dx, c[1] + dy]),
    };
  } else if (geometry.type === 'Polygon') {
    return {
      type: 'Polygon',
      coordinates: (geometry as Polygon).coordinates.map((ring) =>
        ring.map((c) => [c[0] + dx, c[1] + dy]),
      ),
    };
  }
  return geometry;
}

/** Empty GeoJSON FeatureCollection */
export function emptyFC(): GeoJSON.FeatureCollection {
  return { type: 'FeatureCollection', features: [] };
}
