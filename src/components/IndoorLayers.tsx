import { useMemo } from 'react';
import { Source, Layer } from 'react-map-gl/mapbox';
import type { FeatureCollection, Feature } from 'geojson';
import { useMapStore } from '../store/useMapStore';
import { COLORS } from '../config';

/** Source / layer IDs (exported so the editor can query them) */
export const LAYER_IDS = {
  floor: 'indoor-floor',
  floorOutline: 'indoor-floor-outline',
  walls: 'indoor-walls',
  wallsHit: 'indoor-walls-hit',
  wallPreview: 'indoor-wall-preview',
  doors: 'indoor-doors',
  stairs: 'indoor-stairs',
  stairsOutline: 'indoor-stairs-outline',
  elevators: 'indoor-elevators',
} as const;

function emptyFC(): FeatureCollection {
  return { type: 'FeatureCollection', features: [] };
}

export default function IndoorLayers() {
  const floors = useMapStore((s) => s.floors);
  const currentFloorIdx = useMapStore((s) => s.currentFloorIdx);
  const selectedObjectId = useMapStore((s) => s.selectedObjectId);

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
  const { wallsFC, doorsFC, stairsFC, elevatorsFC } = useMemo(() => {
    const objects = floor?.objects ?? [];

    const toFeature = (o: (typeof objects)[number]): Feature => ({
      type: 'Feature',
      geometry: o.geometry,
      properties: {
        id: o.id,
        selected: o.id === selectedObjectId,
        rotation: o.props.rotation ?? 0,
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
    };
  }, [floor?.objects, selectedObjectId]);

  // The wall-preview source is always empty — the editor hook
  // will update it imperatively through mapRef.
  const wallPreviewFC = useMemo(() => emptyFC(), []);

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
          paint={{ 'line-color': COLORS.floorOutline, 'line-width': 2 }}
        />
      </Source>

      {/* ── Walls ── */}
      <Source id={LAYER_IDS.walls} type="geojson" data={wallsFC}>
        <Layer
          id={LAYER_IDS.walls}
          type="line"
          paint={{
            'line-color': [
              'case',
              ['==', ['get', 'selected'], true],
              COLORS.wallSelected,
              COLORS.wall,
            ],
            'line-width': 4,
          }}
        />
        {/* Wider invisible hit area for selection */}
        <Layer
          id={LAYER_IDS.wallsHit}
          type="line"
          paint={{ 'line-color': '#000000', 'line-width': 16, 'line-opacity': 0.01 }}
        />
      </Source>

      {/* ── Wall preview (dashed) ── */}
      <Source id={LAYER_IDS.wallPreview} type="geojson" data={wallPreviewFC}>
        <Layer
          id={LAYER_IDS.wallPreview}
          type="line"
          paint={{
            'line-color': COLORS.wallPreview,
            'line-width': 3,
            'line-dasharray': [4, 4],
          }}
        />
      </Source>

      {/* ── Doors ── */}
      <Source id={LAYER_IDS.doors} type="geojson" data={doorsFC}>
        <Layer
          id={LAYER_IDS.doors}
          type="circle"
          paint={{
            'circle-radius': 7,
            'circle-color': [
              'case',
              ['==', ['get', 'selected'], true],
              COLORS.doorSelected,
              COLORS.door,
            ],
            'circle-stroke-width': 2,
            'circle-stroke-color': '#fff',
          }}
        />
      </Source>

      {/* ── Stairs ── */}
      <Source id={LAYER_IDS.stairs} type="geojson" data={stairsFC}>
        <Layer
          id={LAYER_IDS.stairs}
          type="fill"
          paint={{
            'fill-color': [
              'case',
              ['==', ['get', 'selected'], true],
              COLORS.stairSelected,
              COLORS.stair,
            ],
            'fill-opacity': 0.7,
          }}
        />
        <Layer
          id={LAYER_IDS.stairsOutline}
          type="line"
          paint={{ 'line-color': '#555', 'line-width': 1.5 }}
        />
      </Source>

      {/* ── Elevators ── */}
      <Source id={LAYER_IDS.elevators} type="geojson" data={elevatorsFC}>
        <Layer
          id={LAYER_IDS.elevators}
          type="circle"
          paint={{
            'circle-radius': 9,
            'circle-color': [
              'case',
              ['==', ['get', 'selected'], true],
              COLORS.elevatorSelected,
              COLORS.elevator,
            ],
            'circle-stroke-width': 2,
            'circle-stroke-color': '#fff',
          }}
        />
      </Source>
    </>
  );
}
