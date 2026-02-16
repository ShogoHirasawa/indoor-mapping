import { useMemo, useEffect } from 'react';
import { Source, Layer, useMap } from 'react-map-gl/mapbox';
import type { FeatureCollection } from 'geojson';
import type { Position, Polygon } from '../types';
import { useMapStore } from '../store/useMapStore';
import { centroid } from '../utils/geometry';

/**
 * Demo overlay for video capture:
 * - Blue navigation route line extending from outside into the building
 * - Indoor room walls dividing the floor into rooms
 * - POI icons (restrooms, elevators, exits, doors) inside rooms
 */

// ── POI types with visual config ──
const POI_CONFIG: Record<string, { icon: string; color: string; bgColor: string; size: number }> = {
  exit:      { icon: '🚪', color: '#fff', bgColor: '#4caf50', size: 14 },
  restroom:  { icon: '🚻', color: '#fff', bgColor: '#607d8b', size: 14 },
  elevator:  { icon: '🛗', color: '#fff', bgColor: '#1565c0', size: 14 },
  door:      { icon: '🚪', color: '#fff', bgColor: '#333',    size: 12 },
  info:      { icon: 'ℹ',  color: '#fff', bgColor: '#ff9800', size: 12 },
};

function buildRouteGeoJSON(center: Position, footprint: Polygon): FeatureCollection {
  const [cLng, cLat] = center;
  const ring = footprint.coordinates[0];

  // Find the southernmost point of the building as entrance
  let southPt = ring[0];
  for (const pt of ring) {
    if (pt[1] < southPt[1]) southPt = pt;
  }
  const entranceLng = (southPt[0] + cLng) / 2;
  const entranceLat = southPt[1];

  // Route: approach from south, enter building, navigate to center
  const route: Position[] = [
    [entranceLng - 0.001, entranceLat - 0.003],
    [entranceLng - 0.0003, entranceLat - 0.0015],
    [entranceLng, entranceLat - 0.0003],
    [entranceLng, entranceLat],
    [(entranceLng + cLng) / 2, (entranceLat + cLat) / 2],
    [cLng, cLat],
  ];

  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: route },
        properties: {},
      },
    ],
  };
}

function buildRoomWallsGeoJSON(center: Position, footprint: Polygon): FeatureCollection {
  const [cLng, cLat] = center;
  const ring = footprint.coordinates[0];

  // Compute bounding box
  let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
  for (const [lng, lat] of ring) {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }

  const w = maxLng - minLng;
  const h = maxLat - minLat;
  const pad = 0.12; // padding ratio

  const left   = minLng + w * pad;
  const right  = maxLng - w * pad;
  const bottom = minLat + h * pad;
  const top    = maxLat - h * pad;
  const midX   = (left + right) / 2;
  const midY   = (bottom + top) / 2;
  const thirdX = left + (right - left) / 3;
  const twoThirdX = left + (right - left) * 2 / 3;
  const thirdY = bottom + (top - bottom) / 3;
  const twoThirdY = bottom + (top - bottom) * 2 / 3;

  // Room dividing walls
  const walls: Position[][] = [
    // Horizontal dividers
    [[left, twoThirdY], [right, twoThirdY]],
    [[left, thirdY], [twoThirdX, thirdY]],
    // Vertical dividers
    [[thirdX, twoThirdY], [thirdX, top]],
    [[twoThirdX, bottom], [twoThirdX, twoThirdY]],
    [[midX, thirdY], [midX, twoThirdY]],
    // Small room partitions (top area)
    [[thirdX + (twoThirdX - thirdX) * 0.5, twoThirdY], [thirdX + (twoThirdX - thirdX) * 0.5, top]],
  ];

  return {
    type: 'FeatureCollection',
    features: walls.map((coords) => ({
      type: 'Feature' as const,
      geometry: { type: 'LineString' as const, coordinates: coords },
      properties: {},
    })),
  };
}

function buildPOIGeoJSON(center: Position, footprint: Polygon): FeatureCollection {
  const ring = footprint.coordinates[0];

  let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
  for (const [lng, lat] of ring) {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }

  const w = maxLng - minLng;
  const h = maxLat - minLat;
  const pad = 0.12;

  const left   = minLng + w * pad;
  const right  = maxLng - w * pad;
  const bottom = minLat + h * pad;
  const top    = maxLat - h * pad;
  const thirdX = left + (right - left) / 3;
  const twoThirdX = left + (right - left) * 2 / 3;
  const thirdY = bottom + (top - bottom) / 3;
  const twoThirdY = bottom + (top - bottom) * 2 / 3;
  const midX   = (left + right) / 2;
  const midY   = (bottom + top) / 2;

  // POI locations
  const pois: { type: string; coords: Position }[] = [
    // Exits
    { type: 'exit', coords: [left, (bottom + thirdY) / 2] },
    { type: 'exit', coords: [right, (twoThirdY + top) / 2] },
    // Restrooms (top-left area)
    { type: 'restroom', coords: [(left + thirdX) / 2, (twoThirdY + top) / 2] },
    { type: 'restroom', coords: [(thirdX + twoThirdX) * 0.5 - (twoThirdX - thirdX) * 0.12, (twoThirdY + top) / 2] },
    // Elevators
    { type: 'elevator', coords: [midX, (thirdY + twoThirdY) / 2] },
    { type: 'elevator', coords: [right - (right - left) * 0.08, (twoThirdY + top) / 2] },
    // Doors
    { type: 'door', coords: [(left + thirdX) / 2, midY] },
    { type: 'door', coords: [(thirdX + midX) / 2, midY] },
    { type: 'door', coords: [(midX + twoThirdX) / 2, midY] },
    { type: 'door', coords: [(twoThirdX + right) / 2, (bottom + thirdY) / 2] },
    { type: 'door', coords: [thirdX, (twoThirdY + top) * 0.5 + (top - twoThirdY) * 0.15] },
    // Info point
    { type: 'info', coords: [(twoThirdX + right) / 2, midY] },
  ];

  return {
    type: 'FeatureCollection',
    features: pois.map((poi) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: poi.coords },
      properties: { poiType: poi.type },
    })),
  };
}

// ── Current-location pulse marker ──
function buildCurrentLocationGeoJSON(center: Position, footprint: Polygon): FeatureCollection {
  const ring = footprint.coordinates[0];
  let minLat = Infinity;
  let southPt: Position = ring[0];
  for (const pt of ring) {
    if (pt[1] < minLat) { minLat = pt[1]; southPt = pt as Position; }
  }
  // Place the "current location" marker near the entrance
  const [cLng, cLat] = center;
  const locLng = (southPt[0] + cLng) / 2;
  const locLat = (southPt[1] + cLat) / 2 - (cLat - southPt[1]) * 0.15;

  return {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [locLng, locLat] },
      properties: {},
    }],
  };
}

export default function DemoOverlay() {
  const { current: mapInstance } = useMap();
  const insideBuilding = useMapStore((s) => s.insideBuilding);
  const buildingFootprint = useMapStore((s) => s.buildingFootprint);

  // Load POI icons into the map
  useEffect(() => {
    const map = mapInstance?.getMap();
    if (!map) return;

    // We use text-field symbols so no custom image loading needed
  }, [mapInstance]);

  const fp = buildingFootprint as Polygon | null;
  const center: Position | null = useMemo(() => {
    if (!fp || fp.type !== 'Polygon') return null;
    return centroid(fp.coordinates as Position[][]);
  }, [fp]);

  const routeFC = useMemo(() => {
    if (!center || !fp) return null;
    return buildRouteGeoJSON(center, fp);
  }, [center, fp]);

  const roomWallsFC = useMemo(() => {
    if (!center || !fp) return null;
    return buildRoomWallsGeoJSON(center, fp);
  }, [center, fp]);

  const poiFC = useMemo(() => {
    if (!center || !fp) return null;
    return buildPOIGeoJSON(center, fp);
  }, [center, fp]);

  const currentLocFC = useMemo(() => {
    if (!center || !fp) return null;
    return buildCurrentLocationGeoJSON(center, fp);
  }, [center, fp]);

  if (!fp || !center) return null;

  return (
    <>
      {/* ── Navigation route line (always visible when building selected) ── */}
      {routeFC && (
        <Source id="demo-route" type="geojson" data={routeFC}>
          {/* Route casing (wider, darker line behind) */}
          <Layer
            id="demo-route-casing"
            type="line"
            paint={{
              'line-color': '#1a56db',
              'line-width': 8,
              'line-opacity': 0.4,
            }}
            layout={{ 'line-cap': 'round', 'line-join': 'round' }}
          />
          {/* Route main line */}
          <Layer
            id="demo-route-line"
            type="line"
            paint={{
              'line-color': '#4285f4',
              'line-width': 5,
              'line-opacity': 0.9,
            }}
            layout={{ 'line-cap': 'round', 'line-join': 'round' }}
          />
        </Source>
      )}

      {/* ── Current location blue dot ── */}
      {currentLocFC && (
        <Source id="demo-current-loc" type="geojson" data={currentLocFC}>
          <Layer
            id="demo-current-loc-halo"
            type="circle"
            paint={{
              'circle-radius': 16,
              'circle-color': '#4285f4',
              'circle-opacity': 0.2,
            }}
          />
          <Layer
            id="demo-current-loc-dot"
            type="circle"
            paint={{
              'circle-radius': 8,
              'circle-color': '#4285f4',
              'circle-stroke-width': 3,
              'circle-stroke-color': '#ffffff',
            }}
          />
        </Source>
      )}

      {/* ── Indoor room walls (only when inside) ── */}
      {insideBuilding && roomWallsFC && (
        <Source id="demo-room-walls" type="geojson" data={roomWallsFC}>
          <Layer
            id="demo-room-walls-line"
            type="line"
            paint={{
              'line-color': '#444',
              'line-width': 3,
            }}
          />
        </Source>
      )}

      {/* ── POI icons (only when inside) ── */}
      {insideBuilding && poiFC && (
        <Source id="demo-poi" type="geojson" data={poiFC}>
          {/* Background circles for exit (green) */}
          <Layer
            id="demo-poi-circle-exit"
            type="circle"
            filter={['==', ['get', 'poiType'], 'exit']}
            paint={{
              'circle-radius': 16,
              'circle-color': '#4caf50',
              'circle-stroke-width': 2,
              'circle-stroke-color': '#fff',
            }}
          />
          {/* Background circles for restroom (gray) */}
          <Layer
            id="demo-poi-circle-restroom"
            type="circle"
            filter={['==', ['get', 'poiType'], 'restroom']}
            paint={{
              'circle-radius': 16,
              'circle-color': '#607d8b',
              'circle-stroke-width': 2,
              'circle-stroke-color': '#fff',
            }}
          />
          {/* Background circles for elevator (blue) */}
          <Layer
            id="demo-poi-circle-elevator"
            type="circle"
            filter={['==', ['get', 'poiType'], 'elevator']}
            paint={{
              'circle-radius': 16,
              'circle-color': '#1565c0',
              'circle-stroke-width': 2,
              'circle-stroke-color': '#fff',
            }}
          />
          {/* Background circles for door (dark) */}
          <Layer
            id="demo-poi-circle-door"
            type="circle"
            filter={['==', ['get', 'poiType'], 'door']}
            paint={{
              'circle-radius': 14,
              'circle-color': '#333',
              'circle-stroke-width': 2,
              'circle-stroke-color': '#fff',
            }}
          />
          {/* Background circles for info (orange) */}
          <Layer
            id="demo-poi-circle-info"
            type="circle"
            filter={['==', ['get', 'poiType'], 'info']}
            paint={{
              'circle-radius': 14,
              'circle-color': '#ff9800',
              'circle-stroke-width': 2,
              'circle-stroke-color': '#fff',
            }}
          />
          {/* Emoji icon labels */}
          <Layer
            id="demo-poi-labels"
            type="symbol"
            layout={{
              'text-field': [
                'match', ['get', 'poiType'],
                'exit', '🚪',
                'restroom', '🚻',
                'elevator', '🛗',
                'door', '🚪',
                'info', 'ℹ️',
                '?',
              ],
              'text-size': 16,
              'text-allow-overlap': true,
              'icon-allow-overlap': true,
              'text-anchor': 'center',
            }}
            paint={{}}
          />
        </Source>
      )}
    </>
  );
}
