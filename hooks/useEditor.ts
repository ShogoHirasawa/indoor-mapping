import { useCallback, useRef, useEffect, type RefObject } from 'react';
import type { MapRef, MapMouseEvent } from 'react-map-gl/maplibre';
import type maplibregl from 'maplibre-gl';
import type { Position, Geometry } from '../types';
import { useMapStore } from '../store/useMapStore';
import { LAYER_IDS } from '../components/IndoorLayers';
import { snapCoord } from '../utils/snap';
import {
  pointToSegmentDistance,
  rotatePoint,
  centroid,
  lineStringCenter,
  getObjectCenter,
  translateGeometry,
} from '../utils/geometry';

const CLOSE_THRESHOLD = 0.00008;
const DBLCLICK_MS = 350;

/**
 * useEditor — handles placement, selection, drag-move, rotate and delete
 * of indoor objects on the map.
 *
 * Wall preview is written imperatively via the mapRef because react-map-gl
 * does not re-render sources fast enough for interactive preview.
 */
export function useEditor(mapRef: RefObject<MapRef | null>) {
  const wallPoints = useRef<Position[]>([]);
  const lastWallClickTime = useRef(0);
  const passagePoints = useRef<Position[]>([]);
  const lastPassageClickTime = useRef(0);
  const isDragging = useRef(false);
  const justDragged = useRef(false);
  const dragObjectId = useRef<string | null>(null);
  const dragOffset = useRef<Position>([0, 0]);
  const dragHandleType = useRef<'vertex' | 'midpoint' | null>(null);
  const dragHandleIndex = useRef(-1);

  // ── Store selectors (stable) ──
  const addObject = useMapStore((s) => s.addObject);
  const updateObject = useMapStore((s) => s.updateObject);
  const pushUndoSnapshot = useMapStore((s) => s.pushUndoSnapshot);
  const selectObject = useMapStore((s) => s.selectObject);
  const showToast = useMapStore((s) => s.showToast);
  const activeTool = useMapStore((s) => s.activeTool);

  // ── Helpers ──

  const getMap = useCallback(() => mapRef.current?.getMap() ?? null, [mapRef]);

  /** Build preview features from the current polygon vertices + cursor. */
  const setWallPreview = useCallback(
    (points: Position[], cursor: Position | null) => {
      const map = getMap();
      if (!map) return;
      const src = map.getSource(LAYER_IDS.wallPreview) as maplibregl.GeoJSONSource | undefined;
      if (!src) return;

      if (points.length === 0) {
        src.setData({ type: 'FeatureCollection', features: [] });
        return;
      }

      const all = cursor ? [...points, cursor] : [...points];
      const features: GeoJSON.Feature[] = [];

      if (all.length >= 3) {
        features.push({
          type: 'Feature',
          geometry: { type: 'Polygon', coordinates: [[...all, all[0]]] },
          properties: { kind: 'fill' },
        });
      }

      if (all.length >= 2) {
        features.push({
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: all.length >= 3 ? [...all, all[0]] : all,
          },
          properties: { kind: 'outline' },
        });
      }

      for (const pt of points) {
        features.push({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: pt },
          properties: { kind: 'vertex' },
        });
      }

      src.setData({ type: 'FeatureCollection', features });
    },
    [getMap],
  );

  // Reset wall drawing state when switching away from the Wall tool
  useEffect(() => {
    if (activeTool !== 'Wall' && wallPoints.current.length > 0) {
      wallPoints.current = [];
      setWallPreview([], null);
    }
  }, [activeTool, setWallPreview]);

  /** Passage preview: LineString from points + cursor, with vertex markers */
  const setPassagePreview = useCallback(
    (points: Position[], cursor: Position | null) => {
      const map = getMap();
      if (!map) return;
      const src = map.getSource(LAYER_IDS.passagePreview) as maplibregl.GeoJSONSource | undefined;
      if (!src) return;

      if (points.length === 0) {
        src.setData({ type: 'FeatureCollection', features: [] });
        return;
      }

      const all = cursor ? [...points, cursor] : [...points];
      const features: GeoJSON.Feature[] = [];

      if (all.length >= 2) {
        features.push({
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: all },
          properties: { kind: 'line' },
        });
      }

      for (const pt of points) {
        features.push({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: pt },
          properties: { kind: 'vertex' },
        });
      }

      src.setData({ type: 'FeatureCollection', features });
    },
    [getMap],
  );

  useEffect(() => {
    if (activeTool !== 'Passage' && passagePoints.current.length > 0) {
      passagePoints.current = [];
      setPassagePreview([], null);
    }
  }, [activeTool, setPassagePreview]);

  // ── Finalise wall polygon ──

  const closeWallPolygon = useCallback(() => {
    const pts = wallPoints.current;
    if (pts.length < 3) return;
    const ring = [...pts, pts[0]];
    const geometry: Geometry = { type: 'Polygon', coordinates: [ring] };
    addObject('Wall', geometry);
    wallPoints.current = [];
    setWallPreview([], null);
  }, [addObject, setWallPreview]);

  // ── Click handler ──

  const handleClick = useCallback(
    (e: MapMouseEvent) => {
      // Suppress the click that fires immediately after a drag/handle interaction
      if (justDragged.current) {
        justDragged.current = false;
        return;
      }

      const snap = useMapStore.getState().snapEnabled;
      const tool = useMapStore.getState().activeTool;
      const coord = snapCoord([e.lngLat.lng, e.lngLat.lat], snap);

      if (!tool) {
        const map = getMap();
        if (!map) return;
        const hitLayers = [
          LAYER_IDS.wallsHit,
          LAYER_IDS.passagesHit,
          LAYER_IDS.doorsHit,
          LAYER_IDS.stairsHit,
          LAYER_IDS.elevatorsHit,
          LAYER_IDS.restroomsHit,
          LAYER_IDS.infosHit,
        ].filter((l) => map.getLayer(l));
        const features = map.queryRenderedFeatures(e.point, { layers: hitLayers });
        if (features.length > 0) {
          selectObject(features[0].properties?.id as string);
        } else {
          selectObject(null);
        }
        return;
      }

      switch (tool) {
        case 'Wall':
          handleWallClick(coord);
          break;
        case 'Passage':
          handlePassageClick(coord);
          break;
        case 'Door':
          handleDoorClick(coord);
          break;
        case 'Stair':
        case 'Elevator':
        case 'Restroom':
        case 'Info':
          addObject(tool, { type: 'Point', coordinates: coord });
          break;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [getMap, addObject, selectObject, showToast, setWallPreview, setPassagePreview],
  );

  // ── Wall multi-point polygon ──

  const handleWallClick = useCallback(
    (coord: Position) => {
      const now = Date.now();
      const isDoubleClick = now - lastWallClickTime.current < DBLCLICK_MS;
      lastWallClickTime.current = now;

      const pts = wallPoints.current;

      if (isDoubleClick && pts.length >= 3) {
        closeWallPolygon();
        return;
      }

      if (pts.length >= 3) {
        const first = pts[0];
        const dist = Math.hypot(coord[0] - first[0], coord[1] - first[1]);
        if (dist < CLOSE_THRESHOLD) {
          closeWallPolygon();
          return;
        }
      }

      pts.push(coord);
      setWallPreview(pts, coord);
    },
    [closeWallPolygon, setWallPreview],
  );

  const finishPassage = useCallback(() => {
    const pts = passagePoints.current;
    if (pts.length < 2) return;
    const geometry: Geometry = { type: 'LineString', coordinates: [...pts] };
    addObject('Passage', geometry);
    passagePoints.current = [];
    setPassagePreview([], null);
  }, [addObject, setPassagePreview]);

  const handlePassageClick = useCallback(
    (coord: Position) => {
      const now = Date.now();
      const isDoubleClick = now - lastPassageClickTime.current < DBLCLICK_MS;
      lastPassageClickTime.current = now;

      const pts = passagePoints.current;

      if (isDoubleClick && pts.length >= 2) {
        finishPassage();
        return;
      }

      pts.push(coord);
      setPassagePreview(pts, coord);
    },
    [finishPassage, setPassagePreview],
  );

  // ── Double-click handler (finish wall polygon / passage line) ──

  const handleDblClick = useCallback(
    (e: MapMouseEvent) => {
      const tool = useMapStore.getState().activeTool;
      if (tool === 'Wall' && wallPoints.current.length >= 3) {
        e.preventDefault();
        closeWallPolygon();
      } else if (tool === 'Passage' && passagePoints.current.length >= 2) {
        e.preventDefault();
        finishPassage();
      }
    },
    [closeWallPolygon, finishPassage],
  );

  // ── Door (snap to wall polygon edges or passage lines) ──

  const handleDoorClick = useCallback(
    (coord: Position) => {
      const objects = useMapStore.getState().getCurrentObjects();
      let bestDist = Infinity;
      let bestNearest: Position | null = null;
      let bestLineId: string | null = null;

      for (const obj of objects) {
        if (obj.type === 'Wall') {
          const ring = (obj.geometry as GeoJSON.Polygon).coordinates[0];
          for (let i = 0; i < ring.length - 1; i++) {
            const a = ring[i] as Position;
            const b = ring[i + 1] as Position;
            const { distance, nearest } = pointToSegmentDistance(coord, a, b);
            if (distance < bestDist) {
              bestDist = distance;
              bestNearest = nearest;
              bestLineId = obj.id;
            }
          }
        } else if (obj.type === 'Passage') {
          const coords = (obj.geometry as GeoJSON.LineString).coordinates;
          for (let i = 0; i < coords.length - 1; i++) {
            const a = coords[i] as Position;
            const b = coords[i + 1] as Position;
            const { distance, nearest } = pointToSegmentDistance(coord, a, b);
            if (distance < bestDist) {
              bestDist = distance;
              bestNearest = nearest;
              bestLineId = obj.id;
            }
          }
        }
      }

      const threshold = 0.0001; // ~10 m
      if (bestDist > threshold || !bestNearest) {
        showToast('Door must be placed on a wall or passage');
        return;
      }

      addObject('Door', { type: 'Point', coordinates: bestNearest }, { wallId: bestLineId! });
    },
    [addObject, showToast],
  );

  // ── Mouse move (wall preview + drag + cursor) ──

  const handleMouseMove = useCallback(
    (e: MapMouseEvent) => {
      const map = getMap();

      // ── Active drag ──
      if (isDragging.current && dragObjectId.current) {
        const snap = useMapStore.getState().snapEnabled;
        const obj = useMapStore.getState().getObject(dragObjectId.current);
        if (!obj) return;

        if (map) map.getCanvas().style.cursor = 'grabbing';

        // Vertex handle drag
        if (dragHandleType.current === 'vertex') {
          const coord = snapCoord(
            [e.lngLat.lng - dragOffset.current[0], e.lngLat.lat - dragOffset.current[1]],
            snap,
          );
          if (obj.type === 'Wall') {
            const ring = [...(obj.geometry as GeoJSON.Polygon).coordinates[0]];
            const idx = dragHandleIndex.current;
            ring[idx] = coord;
            if (idx === 0) ring[ring.length - 1] = coord;
            updateObject(obj.id, { geometry: { type: 'Polygon', coordinates: [ring] } }, { skipUndo: true });
          } else if (obj.type === 'Passage') {
            const coords = [...(obj.geometry as GeoJSON.LineString).coordinates];
            coords[dragHandleIndex.current] = coord;
            updateObject(obj.id, { geometry: { type: 'LineString', coordinates: coords } }, { skipUndo: true });
          }
          return;
        }

        // Whole-object drag
        const newCenter = snapCoord(
          [e.lngLat.lng - dragOffset.current[0], e.lngLat.lat - dragOffset.current[1]],
          snap,
        );
        const currentCenter = getObjectCenter(obj.geometry);
        const dx = newCenter[0] - currentCenter[0];
        const dy = newCenter[1] - currentCenter[1];
        const newGeometry = translateGeometry(obj.geometry, dx, dy);
        updateObject(obj.id, { geometry: newGeometry as any }, { skipUndo: true });
        return;
      }

      // ── Wall preview while drawing ──
      const tool = useMapStore.getState().activeTool;
      if (tool === 'Wall' && wallPoints.current.length > 0) {
        const snap = useMapStore.getState().snapEnabled;
        const coord = snapCoord([e.lngLat.lng, e.lngLat.lat], snap);
        setWallPreview(wallPoints.current, coord);
        return;
      }

      if (tool === 'Passage' && passagePoints.current.length > 0) {
        const snap = useMapStore.getState().snapEnabled;
        const coord = snapCoord([e.lngLat.lng, e.lngLat.lat], snap);
        setPassagePreview(passagePoints.current, coord);
        return;
      }

      // ── Cursor feedback (idle, no tool) ──
      if (!tool && map) {
        const canvas = map.getCanvas();
        const selected = useMapStore.getState().getSelectedObject();

        if (selected?.type === 'Wall' && map.getLayer(LAYER_IDS.wallHandlesHit)) {
          const hits = map.queryRenderedFeatures(e.point, {
            layers: [LAYER_IDS.wallHandlesHit],
          });
          if (hits.some((f) => f.properties?.wallId === selected.id)) {
            canvas.style.cursor = 'move';
            return;
          }
        }

        if (selected?.type === 'Passage' && map.getLayer(LAYER_IDS.passageHandlesHit)) {
          const hits = map.queryRenderedFeatures(e.point, {
            layers: [LAYER_IDS.passageHandlesHit],
          });
          if (hits.some((f) => f.properties?.passageId === selected.id)) {
            canvas.style.cursor = 'move';
            return;
          }
        }

        const hitLayers = [
          LAYER_IDS.wallsHit,
          LAYER_IDS.passagesHit,
          LAYER_IDS.doorsHit,
          LAYER_IDS.stairsHit,
          LAYER_IDS.elevatorsHit,
          LAYER_IDS.restroomsHit,
          LAYER_IDS.infosHit,
        ].filter((l) => map.getLayer(l));
        if (hitLayers.length > 0) {
          const objectHits = map.queryRenderedFeatures(e.point, { layers: hitLayers });
          if (objectHits.length > 0) {
            canvas.style.cursor =
              selected && objectHits.some((f) => f.properties?.id === selected.id)
                ? 'move'
                : 'pointer';
            return;
          }
        }

        canvas.style.cursor = '';
      }
    },
    [getMap, updateObject, setWallPreview, setPassagePreview],
  );

  // ── Mouse down (start drag) ──

  const handleMouseDown = useCallback(
    (e: MapMouseEvent) => {
      const tool = useMapStore.getState().activeTool;
      if (tool) return; // don't drag while placing

      const selected = useMapStore.getState().getSelectedObject();
      if (!selected) return;

      const map = getMap();
      if (!map) return;

      // --- Check wall vertex / midpoint handles first ---
      if (selected.type === 'Wall' && map.getLayer(LAYER_IDS.wallHandlesHit)) {
        const handleHits = map.queryRenderedFeatures(e.point, {
          layers: [LAYER_IDS.wallHandlesHit],
        });
        const match = handleHits.find(
          (f: maplibregl.MapGeoJSONFeature) => f.properties?.wallId === selected.id,
        );
        if (match) {
          const hType = match.properties?.handleType as string;
          const idx = Number(match.properties?.index);

          pushUndoSnapshot();
          isDragging.current = true;
          dragObjectId.current = selected.id;
          map.dragPan.disable();
          map.getCanvas().style.cursor = 'grabbing';

          if (hType === 'midpoint') {
            const ring = [...(selected.geometry as GeoJSON.Polygon).coordinates[0]];
            const a = ring[idx] as Position;
            const b = ring[idx + 1] as Position;
            const mid: Position = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
            ring.splice(idx + 1, 0, mid);
            updateObject(selected.id, { geometry: { type: 'Polygon', coordinates: [ring] } }, { skipUndo: true });
            dragHandleType.current = 'vertex';
            dragHandleIndex.current = idx + 1;
            dragOffset.current = [0, 0];
          } else {
            dragHandleType.current = 'vertex';
            dragHandleIndex.current = idx;
            const ring = (selected.geometry as GeoJSON.Polygon).coordinates[0];
            const vPos = ring[idx] as Position;
            dragOffset.current = [e.lngLat.lng - vPos[0], e.lngLat.lat - vPos[1]];
          }
          return;
        }
      }

      // --- Check passage vertex / midpoint handles ---
      if (selected.type === 'Passage' && map.getLayer(LAYER_IDS.passageHandlesHit)) {
        const handleHits = map.queryRenderedFeatures(e.point, {
          layers: [LAYER_IDS.passageHandlesHit],
        });
        const match = handleHits.find(
          (f: maplibregl.MapGeoJSONFeature) => f.properties?.passageId === selected.id,
        );
        if (match) {
          const hType = match.properties?.handleType as string;
          const idx = Number(match.properties?.index);

          pushUndoSnapshot();
          isDragging.current = true;
          dragObjectId.current = selected.id;
          map.dragPan.disable();
          map.getCanvas().style.cursor = 'grabbing';

          if (hType === 'midpoint') {
            const coords = [...(selected.geometry as GeoJSON.LineString).coordinates];
            const a = coords[idx] as Position;
            const b = coords[idx + 1] as Position;
            const mid: Position = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
            coords.splice(idx + 1, 0, mid);
            updateObject(selected.id, { geometry: { type: 'LineString', coordinates: coords } }, { skipUndo: true });
            dragHandleType.current = 'vertex';
            dragHandleIndex.current = idx + 1;
            dragOffset.current = [0, 0];
          } else {
            dragHandleType.current = 'vertex';
            dragHandleIndex.current = idx;
            const coords = (selected.geometry as GeoJSON.LineString).coordinates;
            const vPos = coords[idx] as Position;
            dragOffset.current = [e.lngLat.lng - vPos[0], e.lngLat.lat - vPos[1]];
          }
          return;
        }
      }

      // --- Regular object drag ---
      const hitLayers = [
        LAYER_IDS.wallsHit,
        LAYER_IDS.passagesHit,
        LAYER_IDS.doorsHit,
        LAYER_IDS.stairsHit,
        LAYER_IDS.elevatorsHit,
        LAYER_IDS.restroomsHit,
        LAYER_IDS.infosHit,
      ].filter((l) => map.getLayer(l));
      const features = map.queryRenderedFeatures(e.point, { layers: hitLayers });
      const hit = features.find((f: maplibregl.MapGeoJSONFeature) => f.properties?.id === selected.id);
      if (hit) {
        pushUndoSnapshot();
        isDragging.current = true;
        dragObjectId.current = selected.id;
        dragHandleType.current = null;
        dragHandleIndex.current = -1;
        const objCenter = getObjectCenter(selected.geometry);
        dragOffset.current = [e.lngLat.lng - objCenter[0], e.lngLat.lat - objCenter[1]];
        map.dragPan.disable();
        map.getCanvas().style.cursor = 'grabbing';
      }
    },
    [getMap, updateObject, pushUndoSnapshot],
  );

  // ── Mouse up (end drag) ──

  const handleMouseUp = useCallback(
    (_e: MapMouseEvent) => {
      if (isDragging.current) {
        justDragged.current = true;
        isDragging.current = false;
        dragObjectId.current = null;
        dragHandleType.current = null;
        dragHandleIndex.current = -1;
        const map = getMap();
        if (map) {
          map.dragPan.enable();
          map.getCanvas().style.cursor = '';
        }
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

      if (obj.type === 'Wall' || obj.type === 'Stair') {
        const coords = (obj.geometry as GeoJSON.Polygon).coordinates;
        const center = centroid(coords as Position[][]);
        const newCoords = coords.map((ring) =>
          ring.map((p) => rotatePoint(p as Position, center, delta)),
        );
        updateObject(obj.id, {
          geometry: { type: 'Polygon', coordinates: newCoords },
          props: { rotation: targetAngle },
        });
      } else if (obj.type === 'Passage') {
        const coords = (obj.geometry as GeoJSON.LineString).coordinates as Position[];
        const center = lineStringCenter(coords);
        const newCoords = coords.map((p) => rotatePoint(p, center, delta));
        updateObject(obj.id, {
          geometry: { type: 'LineString', coordinates: newCoords },
          props: { rotation: targetAngle },
        });
      } else {
        updateObject(obj.id, { props: { rotation: targetAngle } });
      }
    },
    [updateObject],
  );

  return {
    handleClick,
    handleDblClick,
    handleMouseMove,
    handleMouseDown,
    handleMouseUp,
    rotateSelectedTo,
  };
}
