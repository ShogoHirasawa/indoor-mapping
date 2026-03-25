import { useCallback, useEffect, useState } from 'react';
import type { MapMouseEvent } from 'react-map-gl/maplibre';
import type { Geometry, Position } from '../types';
import { useMapStore } from '../store/useMapStore';
import { createRectPolygon } from '../utils/geometry';
import { FLOOR_HEIGHT } from '../config';
import { useIndoorSync } from './useIndoorSync';
import { getIndoorContext, getIndoorList } from '../utils/indoorApi';
import { createClient } from '@/utils/supabase/client';

/** Ray-casting point-in-polygon test */
function pointInRing(point: Position, ring: Position[]): boolean {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/** True if point is inside the geometry (Polygon or MultiPolygon). */
function pointInGeometry(geom: Geometry, point: Position): boolean {
  if (geom.type === 'Polygon') return pointInRing(point, geom.coordinates[0] as Position[]);
  if (geom.type === 'MultiPolygon') {
    for (const poly of geom.coordinates) {
      if (pointInRing(point, poly[0] as Position[])) return true;
    }
    return false;
  }
  return false;
}

/** Signed area of a polygon ring (shoelace). Used to compare footprint sizes. */
function ringArea(ring: Position[]): number {
  let area = 0;
  const n = ring.length - 1;
  for (let i = 0; i < n; i++) {
    const [x0, y0] = ring[i];
    const [x1, y1] = ring[i + 1];
    area += x0 * y1 - x1 * y0;
  }
  return Math.abs(area) / 2;
}

/** Approximate area of Polygon or MultiPolygon (sum of outer rings). */
function geometryArea(geom: Geometry): number {
  if (geom.type === 'Polygon') return ringArea(geom.coordinates[0] as Position[]);
  if (geom.type === 'MultiPolygon') {
    let sum = 0;
    for (const poly of geom.coordinates) sum += ringArea(poly[0] as Position[]);
    return sum;
  }
  return Infinity;
}

/** Extract the single Polygon containing `point` from a MultiPolygon */
function pickPolygon(
  geom: Geometry,
  point: Position,
): Geometry {
  if (geom.type === 'Polygon') return geom;
  if (geom.type !== 'MultiPolygon') return geom;
  for (const polyCoords of (geom as GeoJSON.MultiPolygon).coordinates) {
    if (pointInRing(point, polyCoords[0] as Position[])) {
      return { type: 'Polygon', coordinates: polyCoords };
    }
  }
  // Fallback: use the first polygon
  return { type: 'Polygon', coordinates: (geom as GeoJSON.MultiPolygon).coordinates[0] };
}

/** The custom 3D building layer id added by MapView */
export const BUILDING_LAYER = '3d-buildings';
export const BUILDING_HIGHLIGHT_LAYER = 'building-highlight';

/**
 * Hook that provides building click→enter/exit logic.
 *
 * Floor polygon generation is handled here as well:
 * when entering a building the footprint is used (or a fallback rectangle).
 */
export function useBuilding() {
  const insideBuilding = useMapStore((s) => s.insideBuilding);
  const exitBuilding = useMapStore((s) => s.exitBuilding);
  const enterBuilding = useMapStore((s) => s.enterBuilding);
  const setFloorPolygon = useMapStore((s) => s.setFloorPolygon);
  const buildingFootprint = useMapStore((s) => s.buildingFootprint);
  const showToast = useMapStore((s) => s.showToast);
  const { enterBuildingWithDb, loadBuildingById } = useIndoorSync();

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  useEffect(() => {
    createClient().auth.getUser().then(({ data: { user } }) => {
      setIsLoggedIn(!!user);
    });
  }, []);

  /** Generate the floor polygon for the currently selected floor */
  const generateFloorPolygon = useCallback(
    (footprint: Geometry | null) => {
      if (footprint && footprint.type === 'Polygon') {
        setFloorPolygon(JSON.parse(JSON.stringify(footprint)));
      } else if (footprint && footprint.type === 'MultiPolygon') {
        setFloorPolygon({
          type: 'Polygon',
          coordinates: JSON.parse(JSON.stringify(footprint.coordinates[0])),
        });
      } else {
        // fallback rectangle (SF centre)
        setFloorPolygon(createRectPolygon(-122.4194, 37.7749, 0.0003, 0.0002));
      }
    },
    [setFloorPolygon],
  );

  /**
   * Handle a click on a 3D building feature: open existing building (by external_id) or create new.
   * Pick the feature that contains the click point; if multiple overlap, pick the one with
   * smallest footprint area so the building the user actually clicked (the "front" one) is selected.
   */
  const handleBuildingClick = useCallback(
    async (e: MapMouseEvent) => {
      if (insideBuilding) return;
      const features = e.features ?? [];
      if (features.length === 0) return;

      const clickPt: Position = [e.lngLat.lng, e.lngLat.lat];

      const candidates = features.filter((f) => {
        const geom = f.geometry as Geometry;
        return geom && pointInGeometry(geom, clickPt);
      });

      const feature =
        candidates.length > 0
          ? candidates.sort((a, b) => {
              const areaA = geometryArea(a.geometry as Geometry);
              const areaB = geometryArea(b.geometry as Geometry);
              return areaA - areaB;
            })[0]
          : features[0];

      const rawGeom = feature.geometry as Geometry;
      const footprint = pickPolygon(rawGeom, clickPt);

      const rawHeight = Number((feature.properties as Record<string, unknown>)?.render_height) || 0;
      const renderHeight = rawHeight > 0 ? rawHeight : FLOOR_HEIGHT;
      const levels = Math.max(1, Math.round(renderHeight / FLOOR_HEIGHT));
      const props = feature.properties as Record<string, unknown>;
      const externalId =
        feature.id != null
          ? String(feature.id)
          : props?.osm_id != null
            ? String(props.osm_id)
            : undefined;
      const name =
        externalId != null ? `Building ${externalId}` : undefined;

      if (externalId) {
        const ctx = await getIndoorContext().catch(() => null);
        const venueId = ctx?.venues?.[0]?.id;
        if (venueId) {
          const list = (await getIndoorList('buildings', { venue_id: venueId })) as { id: string; external_id: string | null }[];
          const existing = list?.find((b) => b.external_id === externalId);
          if (existing) {
            const ok = await loadBuildingById(existing.id);
            if (ok) generateFloorPolygon(footprint);
            return;
          }
        }
      }

      if (!isLoggedIn) {
        // Enter building locally (read-only, no DB writes)
        enterBuilding(`local-${Date.now()}`, footprint, levels);
        generateFloorPolygon(footprint);
        return;
      }
      const _buildingId = await enterBuildingWithDb(footprint, levels, name, externalId);
      if (_buildingId) generateFloorPolygon(footprint);
    },
    [insideBuilding, isLoggedIn, enterBuilding, enterBuildingWithDb, loadBuildingById, generateFloorPolygon, showToast],
  );

  /** Re-generate floor polygon when floor changes */
  const regenerateFloor = useCallback(() => {
    const fp = useMapStore.getState().buildingFootprint;
    if (fp) generateFloorPolygon(fp);
  }, [generateFloorPolygon]);

  return {
    insideBuilding,
    buildingFootprint,
    handleBuildingClick,
    exitBuilding,
    regenerateFloor,
  };
}
