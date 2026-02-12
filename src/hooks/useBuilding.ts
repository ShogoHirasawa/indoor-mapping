import { useCallback } from 'react';
import type { MapMouseEvent } from 'react-map-gl/mapbox';
import type { Geometry } from '../types';
import { useMapStore } from '../store/useMapStore';
import { createRectPolygon } from '../utils/geometry';

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

      const footprint = feature.geometry as Geometry;
      const buildingId = feature.id
        ? String(feature.id)
        : (feature.properties as Record<string, unknown>)?.osm_id
          ? String((feature.properties as Record<string, unknown>).osm_id)
          : `bldg-${Date.now()}`;

      enterBuilding(buildingId, footprint);
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
