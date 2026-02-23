import { useCallback } from 'react';
import type { MapMouseEvent } from 'react-map-gl/maplibre';
import type { Geometry, Position } from '../types';
import { useMapStore } from '../store/useMapStore';
import { createRectPolygon } from '../utils/geometry';
import { FLOOR_HEIGHT } from '../config';

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
  const enterBuilding = useMapStore((s) => s.enterBuilding);
  const exitBuilding = useMapStore((s) => s.exitBuilding);
  const setFloorPolygon = useMapStore((s) => s.setFloorPolygon);
  const buildingFootprint = useMapStore((s) => s.buildingFootprint);

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

  /** Handle a click on a 3D building feature */
  const handleBuildingClick = useCallback(
    (e: MapMouseEvent) => {
      if (insideBuilding) return;
      const feature = e.features?.[0];
      if (!feature) return;

      const rawGeom = feature.geometry as Geometry;
      const clickPt: Position = [e.lngLat.lng, e.lngLat.lat];
      const footprint = pickPolygon(rawGeom, clickPt);

      const buildingId = feature.id
        ? String(feature.id)
        : (feature.properties as Record<string, unknown>)?.osm_id
          ? String((feature.properties as Record<string, unknown>).osm_id)
          : `bldg-${Date.now()}`;

      const rawHeight = Number((feature.properties as Record<string, unknown>)?.render_height) || 0;
      const renderHeight = rawHeight > 0 ? rawHeight : FLOOR_HEIGHT;
      const levels = Math.max(1, Math.round(renderHeight / FLOOR_HEIGHT));

      enterBuilding(buildingId, footprint, levels);
      generateFloorPolygon(footprint);
    },
    [insideBuilding, enterBuilding, generateFloorPolygon],
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
