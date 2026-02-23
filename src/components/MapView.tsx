import { useRef, useCallback, useState, useEffect, useMemo } from 'react';
import Map, {
  NavigationControl,
  GeolocateControl,
  Layer,
  Source,
  type MapRef,
  type MapMouseEvent,
} from 'react-map-gl/maplibre';
import type maplibregl from 'maplibre-gl';
import type { FeatureCollection } from 'geojson';
import 'maplibre-gl/dist/maplibre-gl.css';

import { useMapStore } from '../store/useMapStore';
import { useBuilding, BUILDING_LAYER, BUILDING_HIGHLIGHT_LAYER } from '../hooks/useBuilding';
import { useEditor } from '../hooks/useEditor';
import { POI_ICON_MAP } from '../config';
import IndoorLayers from './IndoorLayers';
import EntranceLayers from './EntranceLayers';
import SearchBar from './SearchBar';

const INITIAL_VIEW = {
  longitude: -122.4194,
  latitude: 37.7749,
  zoom: 17,
  pitch: 60,
  bearing: -17.6,
};

export default function MapView() {
  const mapRef = useRef<MapRef>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  const insideBuilding = useMapStore((s) => s.insideBuilding);
  const mode = useMapStore((s) => s.mode);
  const activeTool = useMapStore((s) => s.activeTool);
  const buildingFootprint = useMapStore((s) => s.buildingFootprint);
  const { handleBuildingClick } = useBuilding();
  const { handleClick, handleMouseMove, handleMouseDown, handleMouseUp } = useEditor(mapRef);

  // ── Callbacks ──

  const loadAllIcons = useCallback(async (map: maplibregl.Map) => {
    const base = import.meta.env.BASE_URL;
    for (const [iconId, filename] of Object.entries(POI_ICON_MAP)) {
      if (map.hasImage(iconId)) continue;
      try {
        const resp = await map.loadImage(`${base}${filename}`);
        if (!map.hasImage(iconId)) map.addImage(iconId, resp.data);
      } catch { /* ignore */ }
    }
  }, []);

  const onMapLoad = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;

    // Standard style: keep built-in 3D buildings visible in browse mode
    // They will be toggled off when entering a building (see useEffect below)

    // Load POI icon images & re-load on style changes or missing images
    loadAllIcons(map);
    map.on('styleimagemissing', async (e: { id: string }) => {
      if (e.id in POI_ICON_MAP) {
        try {
          const base = import.meta.env.BASE_URL;
          const resp = await map.loadImage(`${base}${POI_ICON_MAP[e.id]}`);
          if (!map.hasImage(e.id)) map.addImage(e.id, resp.data);
        } catch { /* ignore */ }
      }
    });
    map.on('style.load', () => loadAllIcons(map));

    setMapLoaded(true);
  }, [loadAllIcons]);

  const onClick = useCallback(
    (e: MapMouseEvent) => {
      if (!insideBuilding) {
        handleBuildingClick(e);
        return;
      }
      if (mode === 'edit') {
        handleClick(e);
      }
    },
    [insideBuilding, mode, handleBuildingClick, handleClick],
  );

  const onMouseMove = useCallback(
    (e: MapMouseEvent) => {
      if (!insideBuilding || mode !== 'edit') return;
      handleMouseMove(e);
    },
    [insideBuilding, mode, handleMouseMove],
  );

  const onMouseDown = useCallback(
    (e: MapMouseEvent) => {
      if (!insideBuilding || mode !== 'edit') return;
      handleMouseDown(e);
    },
    [insideBuilding, mode, handleMouseDown],
  );

  const onMouseUp = useCallback(
    (e: MapMouseEvent) => {
      if (!insideBuilding || mode !== 'edit') return;
      handleMouseUp(e);
    },
    [insideBuilding, mode, handleMouseUp],
  );

  // Hide base style building layers when inside a building
  const BASE_BUILDING_LAYERS = ['building', 'building-top'];
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map || !mapLoaded) return;
    const vis = insideBuilding ? 'none' : 'visible';
    for (const id of BASE_BUILDING_LAYERS) {
      try { map.setLayoutProperty(id, 'visibility', vis); } catch { /* ignore */ }
    }
  }, [insideBuilding, mapLoaded]);

  const cursor = insideBuilding && mode === 'edit' ? (activeTool ? 'crosshair' : 'default') : '';

  // GeoJSON for the selected building highlight (orange 3D frame)
  const highlightFC: FeatureCollection = useMemo(() => {
    if (!buildingFootprint) return { type: 'FeatureCollection', features: [] };
    return {
      type: 'FeatureCollection',
      features: [{ type: 'Feature', geometry: buildingFootprint, properties: {} }],
    };
  }, [buildingFootprint]);

  return (
    <Map
      ref={mapRef}
      initialViewState={INITIAL_VIEW}
      mapStyle="https://tiles.openfreemap.org/styles/bright"
      interactiveLayerIds={mapLoaded ? [BUILDING_LAYER] : []}
      onClick={onClick}
      onMouseMove={onMouseMove}
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
      onLoad={onMapLoad}
      cursor={cursor}
      style={{ width: '100%', height: '100%' }}
    >
      <NavigationControl position="top-left" />
      <GeolocateControl
        position="top-left"
        positionOptions={{ enableHighAccuracy: true }}
        trackUserLocation
      />

      {!insideBuilding && <SearchBar />}

      {/* Building layers (OpenFreeMap / OpenMapTiles schema) */}
      <Source id="building-src" type="vector" url="https://tiles.openfreemap.org/planet">
        {/* Invisible 2D fill for click detection */}
        <Layer
          id={BUILDING_LAYER}
          type="fill"
          source-layer="building"
          filter={['!', ['has', 'hide_3d']]}
          minzoom={15}
          paint={{ 'fill-color': '#000', 'fill-opacity': 0.01 }}
        />
        {/* 3D extrusion — warm beige, hidden when inside a building */}
        <Layer
          id="3d-buildings-extrusion"
          type="fill-extrusion"
          source-layer="building"
          filter={['!', ['has', 'hide_3d']]}
          minzoom={15}
          layout={{ visibility: insideBuilding ? 'none' : 'visible' }}
          paint={{
            'fill-extrusion-color': '#f0e6d8',
            'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 10],
            'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
            'fill-extrusion-opacity': 0.8,
          }}
        />
      </Source>

      {/* Selected building: orange outline */}
      {insideBuilding && (
        <Source id="building-highlight-src" type="geojson" data={highlightFC}>
          <Layer
            id={BUILDING_HIGHLIGHT_LAYER}
            type="line"
            paint={{
              'line-color': '#e8734a',
              'line-width': 4,
              'line-opacity': 0.9,
            }}
          />
        </Source>
      )}

      {/* Indoor editing layers (only when inside a building) */}
      {insideBuilding && <IndoorLayers />}

      {/* Entrance markers */}
      {insideBuilding && <EntranceLayers />}
    </Map>
  );
}
