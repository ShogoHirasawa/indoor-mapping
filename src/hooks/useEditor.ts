import { useCallback, useRef, type RefObject } from 'react';
import type { MapRef, MapMouseEvent } from 'react-map-gl/mapbox';
import type mapboxgl from 'mapbox-gl';
import type { Position, Geometry } from '../types';
import { useMapStore } from '../store/useMapStore';
import { STAIR_WIDTH, STAIR_LENGTH } from '../config';
import { LAYER_IDS } from '../components/IndoorLayers';
import { snapCoord } from '../utils/snap';
import {
  pointToSegmentDistance,
  createRectPolygon,
  rotatePoint,
  midpoint,
  centroid,
  getObjectCenter,
  translateGeometry,
} from '../utils/geometry';

/**
 * useEditor — handles placement, selection, drag-move, rotate and delete
 * of indoor objects on the map.
 *
 * Wall preview is written imperatively via the mapRef because react-map-gl
 * does not re-render sources fast enough for interactive preview.
 */
export function useEditor(mapRef: RefObject<MapRef | null>) {
  const wallFirstPoint = useRef<Position | null>(null);
  const isDragging = useRef(false);
  const dragObjectId = useRef<string | null>(null);
  const dragOffset = useRef<Position>([0, 0]);

  // ── Store selectors (stable) ──
  const addObject = useMapStore((s) => s.addObject);
  const updateObject = useMapStore((s) => s.updateObject);
  const selectObject = useMapStore((s) => s.selectObject);
  const showToast = useMapStore((s) => s.showToast);

  // ── Helpers ──

  const getMap = useCallback(() => mapRef.current?.getMap() ?? null, [mapRef]);

  const setWallPreview = useCallback(
    (from: Position | null, to: Position | null) => {
      const map = getMap();
      if (!map) return;
      const src = map.getSource(LAYER_IDS.wallPreview) as mapboxgl.GeoJSONSource | undefined;
      if (!src) return;
      if (from && to) {
        src.setData({
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              geometry: { type: 'LineString', coordinates: [from, to] },
              properties: {},
            },
          ],
        });
      } else {
        src.setData({ type: 'FeatureCollection', features: [] });
      }
    },
    [getMap],
  );

  // ── Click handler ──

  const handleClick = useCallback(
    (e: MapMouseEvent) => {
      const snap = useMapStore.getState().snapEnabled;
      const activeTool = useMapStore.getState().activeTool;
      const coord = snapCoord([e.lngLat.lng, e.lngLat.lat], snap);

      if (!activeTool) {
        // Try to select an existing object
        const map = getMap();
        if (!map) return;
        const hitLayers = [
          LAYER_IDS.wallsHit,
          LAYER_IDS.doors,
          LAYER_IDS.stairs,
          LAYER_IDS.elevators,
        ].filter((l) => map.getLayer(l));
        const features = map.queryRenderedFeatures(e.point, { layers: hitLayers });
        if (features.length > 0) {
          selectObject(features[0].properties?.id as string);
        } else {
          selectObject(null);
        }
        return;
      }

      switch (activeTool) {
        case 'Wall':
          handleWallClick(coord);
          break;
        case 'Door':
          handleDoorClick(coord);
          break;
        case 'Stair':
          addObject('Stair', createRectPolygon(coord[0], coord[1], STAIR_WIDTH, STAIR_LENGTH));
          break;
        case 'Elevator':
          addObject('Elevator', { type: 'Point', coordinates: coord });
          break;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [getMap, addObject, selectObject, showToast, setWallPreview],
  );

  // ── Wall 2-click ──

  const handleWallClick = useCallback(
    (coord: Position) => {
      if (!wallFirstPoint.current) {
        wallFirstPoint.current = coord;
        setWallPreview(coord, coord);
      } else {
        const geometry: Geometry = {
          type: 'LineString',
          coordinates: [wallFirstPoint.current, coord],
        };
        addObject('Wall', geometry);
        wallFirstPoint.current = null;
        setWallPreview(null, null);
      }
    },
    [addObject, setWallPreview],
  );

  // ── Door (wall snap) ──

  const handleDoorClick = useCallback(
    (coord: Position) => {
      const objects = useMapStore.getState().getCurrentObjects();
      const walls = objects.filter((o) => o.type === 'Wall');
      let bestDist = Infinity;
      let bestNearest: Position | null = null;
      let bestWallId: string | null = null;

      for (const wall of walls) {
        const [a, b] = (wall.geometry as GeoJSON.LineString).coordinates;
        const { distance, nearest } = pointToSegmentDistance(coord, a as Position, b as Position);
        if (distance < bestDist) {
          bestDist = distance;
          bestNearest = nearest;
          bestWallId = wall.id;
        }
      }

      const threshold = 0.0001; // ~10 m
      if (bestDist > threshold || !bestNearest) {
        showToast('Door must be placed on a wall');
        return;
      }

      addObject('Door', { type: 'Point', coordinates: bestNearest }, { wallId: bestWallId! });
    },
    [addObject, showToast],
  );

  // ── Mouse move (wall preview + drag) ──

  const handleMouseMove = useCallback(
    (e: MapMouseEvent) => {
      if (isDragging.current && dragObjectId.current) {
        const snap = useMapStore.getState().snapEnabled;
        const obj = useMapStore.getState().getObject(dragObjectId.current);
        if (!obj) return;
        const newCenter = snapCoord(
          [e.lngLat.lng - dragOffset.current[0], e.lngLat.lat - dragOffset.current[1]],
          snap,
        );
        const currentCenter = getObjectCenter(obj.geometry);
        const dx = newCenter[0] - currentCenter[0];
        const dy = newCenter[1] - currentCenter[1];
        const newGeometry = translateGeometry(obj.geometry, dx, dy);
        updateObject(obj.id, { geometry: newGeometry as any });
        return;
      }

      // Wall preview
      const activeTool = useMapStore.getState().activeTool;
      if (activeTool === 'Wall' && wallFirstPoint.current) {
        const snap = useMapStore.getState().snapEnabled;
        const coord = snapCoord([e.lngLat.lng, e.lngLat.lat], snap);
        setWallPreview(wallFirstPoint.current, coord);
      }
    },
    [updateObject, setWallPreview],
  );

  // ── Mouse down (start drag) ──

  const handleMouseDown = useCallback(
    (e: MapMouseEvent) => {
      const activeTool = useMapStore.getState().activeTool;
      if (activeTool) return; // don't drag while placing

      const selected = useMapStore.getState().getSelectedObject();
      if (!selected) return;

      const map = getMap();
      if (!map) return;

      const hitLayers = [
        LAYER_IDS.wallsHit,
        LAYER_IDS.doors,
        LAYER_IDS.stairs,
        LAYER_IDS.elevators,
      ].filter((l) => map.getLayer(l));
      const features = map.queryRenderedFeatures(e.point, { layers: hitLayers });
      const hit = features.find((f: mapboxgl.GeoJSONFeature) => f.properties?.id === selected.id);
      if (hit) {
        isDragging.current = true;
        dragObjectId.current = selected.id;
        const objCenter = getObjectCenter(selected.geometry);
        dragOffset.current = [e.lngLat.lng - objCenter[0], e.lngLat.lat - objCenter[1]];
        map.dragPan.disable();
      }
    },
    [getMap],
  );

  // ── Mouse up (end drag) ──

  const handleMouseUp = useCallback(
    (_e: MapMouseEvent) => {
      if (isDragging.current) {
        isDragging.current = false;
        dragObjectId.current = null;
        const map = getMap();
        map?.dragPan.enable();
      }
    },
    [getMap],
  );

  // ── Rotate selected object to target angle ──

  const rotateSelectedTo = useCallback(
    (targetAngle: number) => {
      const obj = useMapStore.getState().getSelectedObject();
      if (!obj) return;

      const currentRotation = obj.props.rotation ?? 0;
      const delta = targetAngle - currentRotation;
      if (delta === 0) return;

      if (obj.type === 'Wall') {
        const coords = (obj.geometry as GeoJSON.LineString).coordinates as Position[];
        const mid = midpoint(coords);
        const newCoords = coords.map((p) => rotatePoint(p as Position, mid, delta));
        updateObject(obj.id, {
          geometry: { type: 'LineString', coordinates: newCoords },
          props: { rotation: targetAngle },
        });
      } else if (obj.type === 'Stair') {
        const coords = (obj.geometry as GeoJSON.Polygon).coordinates;
        const center = centroid(coords as Position[][]);
        const newCoords = coords.map((ring) =>
          ring.map((p) => rotatePoint(p as Position, center, delta)),
        );
        updateObject(obj.id, {
          geometry: { type: 'Polygon', coordinates: newCoords },
          props: { rotation: targetAngle },
        });
      } else {
        // Point-based (Door / Elevator): just update rotation prop
        updateObject(obj.id, { props: { rotation: targetAngle } });
      }
    },
    [updateObject],
  );

  return {
    handleClick,
    handleMouseMove,
    handleMouseDown,
    handleMouseUp,
    rotateSelectedTo,
  };
}
