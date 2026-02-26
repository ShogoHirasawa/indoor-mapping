import { useMemo } from 'react';
import { Source, Layer } from 'react-map-gl/maplibre';
import type { FeatureCollection, Feature } from 'geojson';
import { useMapStore } from '../store/useMapStore';
import { COLORS, OBJECT_TYPE_ICON } from '../config';

/** Source / layer IDs (exported so the editor can query them) */
export const LAYER_IDS = {
  floor: 'indoor-floor',
  floorOutline: 'indoor-floor-outline',
  walls: 'indoor-walls',
  wallsHit: 'indoor-walls-hit',
  wallPreview: 'indoor-wall-preview',
  wallHandles: 'indoor-wall-handles',
  wallHandlesHit: 'indoor-wall-handles-hit',
  doors: 'indoor-doors',
  doorsHit: 'indoor-doors-hit',
  stairs: 'indoor-stairs',
  stairsHit: 'indoor-stairs-hit',
  elevators: 'indoor-elevators',
  elevatorsHit: 'indoor-elevators-hit',
  restrooms: 'indoor-restrooms',
  restroomsHit: 'indoor-restrooms-hit',
  infos: 'indoor-infos',
  infosHit: 'indoor-infos-hit',
} as const;

function emptyFC(): FeatureCollection {
  return { type: 'FeatureCollection', features: [] };
}

export default function IndoorLayers() {
  const floors = useMapStore((s) => s.floors);
  const currentFloorIdx = useMapStore((s) => s.currentFloorIdx);
  const selectedObjectId = useMapStore((s) => s.selectedObjectId);
  const activeTool = useMapStore((s) => s.activeTool);

  const floor = floors[currentFloorIdx] ?? null;

  // ── Floor polygon ──
  const floorFC: FeatureCollection = useMemo(() => {
    if (!floor?.floorPolygon) return emptyFC();
    return {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: floor.floorPolygon,
          properties: { elevation: floor.elevation },
        },
      ],
    };
  }, [floor?.floorPolygon, floor?.elevation]);

  // ── Objects split by type ──
  const { wallsFC, doorsFC, stairsFC, elevatorsFC, restroomsFC, infosFC } = useMemo(() => {
    const objects = floor?.objects ?? [];

    const toFeature = (o: (typeof objects)[number]): Feature => ({
      type: 'Feature',
      geometry: o.geometry,
      properties: {
        id: o.id,
        selected: o.id === selectedObjectId,
        rotation: o.props.rotation ?? 0,
        objectType: o.type,
        iconId: OBJECT_TYPE_ICON[o.type] ?? '',
      },
    });

    return {
      wallsFC: {
        type: 'FeatureCollection' as const,
        features: objects.filter((o) => o.type === 'Wall').map(toFeature),
      },
      doorsFC: {
        type: 'FeatureCollection' as const,
        features: objects.filter((o) => o.type === 'Door').map(toFeature),
      },
      stairsFC: {
        type: 'FeatureCollection' as const,
        features: objects.filter((o) => o.type === 'Stair').map(toFeature),
      },
      elevatorsFC: {
        type: 'FeatureCollection' as const,
        features: objects.filter((o) => o.type === 'Elevator').map(toFeature),
      },
      restroomsFC: {
        type: 'FeatureCollection' as const,
        features: objects.filter((o) => o.type === 'Restroom').map(toFeature),
      },
      infosFC: {
        type: 'FeatureCollection' as const,
        features: objects.filter((o) => o.type === 'Info').map(toFeature),
      },
    };
  }, [floor?.objects, selectedObjectId]);

  // The wall-preview source is always empty — the editor hook
  // will update it imperatively through mapRef.
  const wallPreviewFC = useMemo(() => emptyFC(), []);

  // ── Vertex + midpoint handles for selected wall ──
  const handlesFC: FeatureCollection = useMemo(() => {
    if (activeTool || !selectedObjectId) return emptyFC();
    const obj = (floor?.objects ?? []).find((o) => o.id === selectedObjectId);
    if (!obj || obj.type !== 'Wall') return emptyFC();

    const ring = (obj.geometry as GeoJSON.Polygon).coordinates[0];
    const features: Feature[] = [];

    for (let i = 0; i < ring.length - 1; i++) {
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: ring[i] },
        properties: { handleType: 'vertex', index: i, wallId: obj.id },
      });
    }

    for (let i = 0; i < ring.length - 1; i++) {
      const a = ring[i];
      const b = ring[i + 1];
      features.push({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2],
        },
        properties: { handleType: 'midpoint', index: i, wallId: obj.id },
      });
    }

    return { type: 'FeatureCollection', features };
  }, [floor?.objects, selectedObjectId, activeTool]);

  return (
    <>
      {/* ── Floor fill + outline ── */}
      <Source id={LAYER_IDS.floor} type="geojson" data={floorFC}>
        <Layer
          id={LAYER_IDS.floor}
          type="fill"
          paint={{ 'fill-color': COLORS.floor, 'fill-opacity': 0.9 }}
        />
        <Layer
          id={LAYER_IDS.floorOutline}
          type="line"
          paint={{ 'line-color': COLORS.floorOutline, 'line-width': 0 }}
        />
      </Source>

      {/* ── Walls (polygon fill + outline) ── */}
      <Source id={LAYER_IDS.walls} type="geojson" data={wallsFC}>
        <Layer
          id={LAYER_IDS.walls}
          type="fill"
          paint={{
            'fill-color': [
              'case',
              ['==', ['get', 'selected'], true],
              COLORS.wallSelected,
              COLORS.wallFill,
            ],
            'fill-opacity': [
              'case',
              ['==', ['get', 'selected'], true],
              0.3,
              0.5,
            ],
          }}
        />
        <Layer
          id={`${LAYER_IDS.walls}-outline`}
          type="line"
          paint={{
            'line-color': [
              'case',
              ['==', ['get', 'selected'], true],
              COLORS.wallSelected,
              COLORS.wall,
            ],
            'line-width': 2,
          }}
        />
        <Layer
          id={LAYER_IDS.wallsHit}
          type="fill"
          paint={{ 'fill-color': '#000000', 'fill-opacity': 0.01 }}
        />
      </Source>

      {/* ── Wall preview (polygon + outline + vertices) ── */}
      <Source id={LAYER_IDS.wallPreview} type="geojson" data={wallPreviewFC}>
        <Layer
          id={`${LAYER_IDS.wallPreview}-fill`}
          type="fill"
          filter={['==', ['get', 'kind'], 'fill']}
          paint={{
            'fill-color': COLORS.wallPreview,
            'fill-opacity': 0.15,
          }}
        />
        <Layer
          id={LAYER_IDS.wallPreview}
          type="line"
          filter={['==', ['get', 'kind'], 'outline']}
          paint={{
            'line-color': COLORS.wallPreview,
            'line-width': 3,
            'line-dasharray': [4, 4],
          }}
        />
        <Layer
          id={`${LAYER_IDS.wallPreview}-vertices`}
          type="circle"
          filter={['==', ['get', 'kind'], 'vertex']}
          paint={{
            'circle-radius': 5,
            'circle-color': COLORS.wallPreview,
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff',
          }}
        />
      </Source>

      {/* ── Doors (icon) ── */}
      <Source id={LAYER_IDS.doors} type="geojson" data={doorsFC}>
        <Layer
          id={`${LAYER_IDS.doors}-bg`}
          type="circle"
          paint={{
            'circle-radius': 10,
            'circle-color': [
              'case', ['==', ['get', 'selected'], true],
              COLORS.doorSelected, COLORS.door,
            ],
            'circle-stroke-width': 2,
            'circle-stroke-color': '#fff',
          }}
        />
        <Layer
          id={LAYER_IDS.doors}
          type="symbol"
          layout={{
            'icon-image': 'icon-door',
            'icon-size': 0.12,
            'icon-allow-overlap': true,
            'icon-anchor': 'center',
          }}
        />
        <Layer
          id={LAYER_IDS.doorsHit}
          type="circle"
          paint={{ 'circle-radius': 14, 'circle-color': '#000', 'circle-opacity': 0.01 }}
        />
      </Source>

      {/* ── Stairs (icon) ── */}
      <Source id={LAYER_IDS.stairs} type="geojson" data={stairsFC}>
        <Layer
          id={`${LAYER_IDS.stairs}-bg`}
          type="circle"
          paint={{
            'circle-radius': 10,
            'circle-color': [
              'case', ['==', ['get', 'selected'], true],
              COLORS.stairSelected, COLORS.stair,
            ],
            'circle-stroke-width': 2,
            'circle-stroke-color': '#fff',
          }}
        />
        <Layer
          id={LAYER_IDS.stairs}
          type="symbol"
          layout={{
            'icon-image': 'icon-stair',
            'icon-size': 0.03,
            'icon-allow-overlap': true,
            'icon-anchor': 'center',
          }}
        />
        <Layer
          id={LAYER_IDS.stairsHit}
          type="circle"
          paint={{ 'circle-radius': 14, 'circle-color': '#000', 'circle-opacity': 0.01 }}
        />
      </Source>

      {/* ── Elevators (icon) ── */}
      <Source id={LAYER_IDS.elevators} type="geojson" data={elevatorsFC}>
        <Layer
          id={`${LAYER_IDS.elevators}-bg`}
          type="circle"
          paint={{
            'circle-radius': 10,
            'circle-color': [
              'case', ['==', ['get', 'selected'], true],
              COLORS.elevatorSelected, COLORS.elevator,
            ],
            'circle-stroke-width': 2,
            'circle-stroke-color': '#fff',
          }}
        />
        <Layer
          id={LAYER_IDS.elevators}
          type="symbol"
          layout={{
            'icon-image': 'icon-elevator',
            'icon-size': 0.12,
            'icon-allow-overlap': true,
            'icon-anchor': 'center',
          }}
        />
        <Layer
          id={LAYER_IDS.elevatorsHit}
          type="circle"
          paint={{ 'circle-radius': 14, 'circle-color': '#000', 'circle-opacity': 0.01 }}
        />
      </Source>

      {/* ── Restrooms (icon) ── */}
      <Source id={LAYER_IDS.restrooms} type="geojson" data={restroomsFC}>
        <Layer
          id={`${LAYER_IDS.restrooms}-bg`}
          type="circle"
          paint={{
            'circle-radius': 10,
            'circle-color': [
              'case', ['==', ['get', 'selected'], true],
              COLORS.restroomSelected, COLORS.restroom,
            ],
            'circle-stroke-width': 2,
            'circle-stroke-color': '#fff',
          }}
        />
        <Layer
          id={LAYER_IDS.restrooms}
          type="symbol"
          layout={{
            'icon-image': 'icon-restroom',
            'icon-size': 0.12,
            'icon-allow-overlap': true,
            'icon-anchor': 'center',
          }}
        />
        <Layer
          id={LAYER_IDS.restroomsHit}
          type="circle"
          paint={{ 'circle-radius': 14, 'circle-color': '#000', 'circle-opacity': 0.01 }}
        />
      </Source>

      {/* ── Info (icon) ── */}
      <Source id={LAYER_IDS.infos} type="geojson" data={infosFC}>
        <Layer
          id={`${LAYER_IDS.infos}-bg`}
          type="circle"
          paint={{
            'circle-radius': 10,
            'circle-color': [
              'case', ['==', ['get', 'selected'], true],
              COLORS.infoSelected, COLORS.info,
            ],
            'circle-stroke-width': 2,
            'circle-stroke-color': '#fff',
          }}
        />
        <Layer
          id={LAYER_IDS.infos}
          type="symbol"
          layout={{
            'icon-image': 'icon-info',
            'icon-size': 0.12,
            'icon-allow-overlap': true,
            'icon-anchor': 'center',
          }}
        />
        <Layer
          id={LAYER_IDS.infosHit}
          type="circle"
          paint={{ 'circle-radius': 14, 'circle-color': '#000', 'circle-opacity': 0.01 }}
        />
      </Source>

      {/* ── Wall vertex / midpoint handles (shown when a wall is selected) ── */}
      <Source id={LAYER_IDS.wallHandles} type="geojson" data={handlesFC}>
        <Layer
          id={`${LAYER_IDS.wallHandles}-midpoints`}
          type="circle"
          filter={['==', ['get', 'handleType'], 'midpoint']}
          paint={{
            'circle-radius': 5,
            'circle-color': COLORS.wallSelected,
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff',
          }}
        />
        <Layer
          id={`${LAYER_IDS.wallHandles}-vertices`}
          type="circle"
          filter={['==', ['get', 'handleType'], 'vertex']}
          paint={{
            'circle-radius': 7,
            'circle-color': COLORS.wallSelected,
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff',
          }}
        />
        <Layer
          id={LAYER_IDS.wallHandlesHit}
          type="circle"
          paint={{
            'circle-radius': 14,
            'circle-color': '#000000',
            'circle-opacity': 0.01,
          }}
        />
      </Source>
    </>
  );
}
