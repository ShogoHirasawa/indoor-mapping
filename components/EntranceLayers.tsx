import { useEffect, useMemo } from 'react';
import { Source, Layer, useMap } from 'react-map-gl/maplibre';
import type { FeatureCollection } from 'geojson';
import { useMapStore } from '../store/useMapStore';
import { useEntrance } from '../hooks/useEntrance';

const SOURCE_ID = 'entrance-points';
const LAYER_ID = 'entrance-layer';
const ICON_ID = 'entrance-icon';

export default function EntranceLayers() {
  const { current: mapInstance } = useMap();
  const buildingFootprint = useMapStore((s) => s.buildingFootprint);
  const insideBuilding = useMapStore((s) => s.insideBuilding);
  const currentFloorIdx = useMapStore((s) => s.currentFloorIdx);

  const {
    entranceData,
    entranceVisible,
    fetchEntrances,
    showEntrances,
    hideEntrances,
    clearEntrances,
  } = useEntrance();

  // Load entrance icon once
  useEffect(() => {
    const map = mapInstance?.getMap();
    if (!map) return;
    if (map.hasImage(ICON_ID)) return;
    (async () => {
      try {
        const resp = await map.loadImage('/entrance-icon.png');
        if (!map.hasImage(ICON_ID)) map.addImage(ICON_ID, resp.data);
      } catch { /* failed to load entrance icon */ }
    })();
  }, [mapInstance]);

  // Fetch entrances when entering a building
  useEffect(() => {
    if (insideBuilding && buildingFootprint) {
      fetchEntrances(buildingFootprint);
    }
    return () => {
      clearEntrances();
    };
    // We only want this to run when we enter a building
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [insideBuilding, buildingFootprint]);

  // Show/hide based on floor (1F = index 0 in dynamic floors)
  useEffect(() => {
    if (currentFloorIdx === 0) {
      showEntrances();
    } else {
      hideEntrances();
    }
  }, [currentFloorIdx, showEntrances, hideEntrances]);

  // Keep entrance layer on top of all other layers
  useEffect(() => {
    const map = mapInstance?.getMap();
    if (!map) return;
    try {
      if (map.getLayer(LAYER_ID)) {
        map.moveLayer(LAYER_ID);
      }
    } catch { /* layer not yet added */ }
  });

  // Build GeoJSON
  const geojson: FeatureCollection = useMemo(() => {
    if (!entranceVisible) return { type: 'FeatureCollection', features: [] };
    return {
      type: 'FeatureCollection',
      features: entranceData.map((pt, i) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [pt.lng, pt.lat] },
        properties: { id: `entrance-${i}`, accuracy: pt.accuracy },
      })),
    };
  }, [entranceData, entranceVisible]);

  return (
    <Source id={SOURCE_ID} type="geojson" data={geojson}>
      <Layer
        id={LAYER_ID}
        type="symbol"
        layout={{
          'icon-image': ICON_ID,
          'icon-size': 0.15,
          'icon-allow-overlap': true,
          'icon-anchor': 'bottom',
        }}
      />
    </Source>
  );
}
