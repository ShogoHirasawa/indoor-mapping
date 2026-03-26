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

/** Center of a LineString (average of all vertices) */
export function lineStringCenter(coords: Position[]): Position {
  if (coords.length === 0) return [0, 0];
  let sx = 0, sy = 0;
  for (const [x, y] of coords) { sx += x; sy += y; }
  return [sx / coords.length, sy / coords.length];
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
    return lineStringCenter(geometry.coordinates as Position[]);
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

/**
 * Orthogonalize a polygon — port of iD editor's actionOrthogonalize.
 * https://github.com/openstreetmap/iD/blob/develop/modules/actions/orthogonalize.js
 *
 * Algorithm:
 * 1. Project lng/lat to local meters (for accurate angle computation).
 * 2. Remove near-straight vertices (angle within threshold of 180°).
 * 3. Iteratively nudge remaining vertices toward 90° corners using
 *    normalized dot product of adjacent edge vectors.
 * 4. Project straight-segment points onto the nearest orthogonalized edge.
 * 5. Convert back to lng/lat.
 */
export function orthogonalizePolygon(polygon: Polygon): Polygon {
  const ring = polygon.coordinates[0].slice();
  // Remove closing vertex
  if (
    ring.length > 1 &&
    ring[0][0] === ring[ring.length - 1][0] &&
    ring[0][1] === ring[ring.length - 1][1]
  ) {
    ring.pop();
  }
  const n = ring.length;
  if (n < 3) return polygon;

  // --- Projection: lng/lat → local meters ---
  let cx = 0, cy = 0;
  for (const [x, y] of ring) { cx += x; cy += y; }
  cx /= n; cy /= n;
  const cosLat = Math.cos((cy * Math.PI) / 180);
  const scaleX = 111320 * cosLat;
  const scaleY = 110540;
  const project = (p: number[]): number[] => [(p[0] - cx) * scaleX, (p[1] - cy) * scaleY];
  const unproject = (p: number[]): number[] => [p[0] / scaleX + cx, p[1] / scaleY + cy];

  // --- Vector helpers (2D, matching iD's geo module) ---
  const vecSub = (a: number[], b: number[]): number[] => [a[0] - b[0], a[1] - b[1]];
  const vecAdd = (a: number[], b: number[]): number[] => [a[0] + b[0], a[1] + b[1]];
  const vecScale = (v: number[], s: number): number[] => [v[0] * s, v[1] * s];
  const vecLen = (v: number[]): number => Math.sqrt(v[0] * v[0] + v[1] * v[1]);
  const vecNorm = (v: number[]): number[] => {
    const l = vecLen(v);
    return l === 0 ? [0, 0] : [v[0] / l, v[1] / l];
  };
  const vecDot = (a: number[], b: number[]): number => a[0] * b[0] + a[1] * b[1];
  const vecInterp = (a: number[], b: number[], t: number): number[] => [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
  ];
  // Project point onto closest position on polyline, return projected point
  const vecProject = (point: number[], polyline: number[][]): number[] | null => {
    let minDist = Infinity;
    let best: number[] | null = null;
    for (let i = 0; i < polyline.length - 1; i++) {
      const a = polyline[i], b = polyline[i + 1];
      const ab = vecSub(b, a);
      const lenSq = vecDot(ab, ab);
      if (lenSq === 0) continue;
      let t = vecDot(vecSub(point, a), ab) / lenSq;
      t = Math.max(0, Math.min(1, t));
      const proj = vecAdd(a, vecScale(ab, t));
      const d = vecLen(vecSub(point, proj));
      if (d < minDist) { minDist = d; best = proj; }
    }
    return best;
  };

  // --- Thresholds (matching iD defaults) ---
  const epsilon = 1e-4;
  const threshold = 13; // degrees
  const lowerThreshold = Math.cos((90 - threshold) * Math.PI / 180);
  const upperThreshold = Math.cos(threshold * Math.PI / 180);

  // Project all points to meters
  let points = ring.map((p) => project(p));

  // --- Separate corners from straight-segment points ---
  const cornerIndices: number[] = [];
  const straightIndices: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = points[(i - 1 + n) % n];
    const o = points[i];
    const b = points[(i + 1) % n];
    const p = vecNorm(vecSub(a, o));
    const q = vecNorm(vecSub(b, o));
    const dotp = Math.abs(vecDot(p, q));
    if (dotp > upperThreshold) {
      straightIndices.push(i);
    } else {
      cornerIndices.push(i);
    }
  }

  if (cornerIndices.length < 3) return polygon; // not enough corners

  // Extract corner points for orthogonalization
  let corners = cornerIndices.map((i) => [...points[i]]);
  const originalCorners = corners.map((p) => [...p]);
  const nc = corners.length;

  // --- Iterative orthogonalization (iD's calcMotion) ---
  const calcMotion = (idx: number): number[] => {
    const a = corners[(idx - 1 + nc) % nc];
    const origin = corners[idx];
    const b = corners[(idx + 1) % nc];
    const p = vecNorm(vecSub(a, origin));
    const q = vecNorm(vecSub(b, origin));
    const scale = 2 * Math.min(
      vecLen(vecSub(a, origin)),
      vecLen(vecSub(b, origin)),
    );
    const dotp = vecDot(p, q);
    const val = Math.abs(dotp);
    if (val < lowerThreshold) {
      // Nearly orthogonal — nudge toward exact 90°
      const vec = vecNorm(vecAdd(p, q));
      return vecScale(vec, 0.1 * dotp * scale);
    }
    return [0, 0];
  };

  const calcScore = (): number => {
    let score = 0;
    for (let i = 0; i < nc; i++) {
      const a = corners[(i - 1 + nc) % nc];
      const o = corners[i];
      const b = corners[(i + 1) % nc];
      const p = vecNorm(vecSub(a, o));
      const q = vecNorm(vecSub(b, o));
      const dotp = vecDot(p, q);
      score += 2 * Math.min(Math.abs(dotp - 1), Math.min(Math.abs(dotp), Math.abs(dotp + 1)));
    }
    return score;
  };

  let bestCorners = corners.map((p) => [...p]);
  let bestScore = Infinity;

  for (let iter = 0; iter < 1000; iter++) {
    const motions = corners.map((_, i) => calcMotion(i));
    for (let j = 0; j < nc; j++) {
      corners[j] = vecAdd(corners[j], motions[j]);
    }
    const score = calcScore();
    if (score < bestScore) {
      bestCorners = corners.map((p) => [...p]);
      bestScore = score;
    }
    if (score < epsilon) break;
  }

  // --- Build result ring ---
  // Start with orthogonalized corners
  const resultPoints = new Map<number, number[]>();
  for (let i = 0; i < cornerIndices.length; i++) {
    const origIdx = cornerIndices[i];
    // Interpolate: move from original toward orthogonalized (t=1 = full move)
    resultPoints.set(origIdx, bestCorners[i]);
  }

  // Project straight-segment points onto nearest edge of orthogonalized shape
  const orthoRing = bestCorners.slice();
  orthoRing.push([...bestCorners[0]]); // close for projection
  for (const si of straightIndices) {
    const projected = vecProject(points[si], orthoRing);
    if (projected) {
      resultPoints.set(si, projected);
    } else {
      resultPoints.set(si, points[si]); // keep original if projection fails
    }
  }

  // Rebuild ring in original vertex order
  const finalRing: Position[] = [];
  for (let i = 0; i < n; i++) {
    const pt = resultPoints.get(i);
    if (pt) {
      finalRing.push(unproject(pt));
    } else {
      finalRing.push(ring[i]);
    }
  }
  // Close ring
  finalRing.push([...finalRing[0]]);

  return { type: 'Polygon', coordinates: [finalRing] };
}

/** Empty GeoJSON FeatureCollection */
export function emptyFC(): GeoJSON.FeatureCollection {
  return { type: 'FeatureCollection', features: [] };
}
