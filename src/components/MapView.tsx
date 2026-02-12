import { useRef, useCallback, useState } from 'react';
import Map, {
  NavigationControl,
  GeolocateControl,
  Layer,
  Source,
  type MapRef,
  type MapMouseEvent,
} from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';

import { MAPBOX_TOKEN } from '../env';
import { useMapStore } from '../store/useMapStore';
import { useBuilding, BUILDING_LAYER, BUILDING_HIGHLIGHT_LAYER } from '../hooks/useBuilding';
import { useEditor } from '../hooks/useEditor';
import IndoorLayers from './IndoorLayers';
import EntranceLayers from './EntranceLayers';

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
  const selectedBuildingId = useMapStore((s) => s.buildingId);

  const { handleBuildingClick } = useBuilding();
  const { handleClick, handleMouseMove, handleMouseDown, handleMouseUp } = useEditor(mapRef);

  // ── Callbacks ──

  const onMapLoad = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;

    // Hide default Mapbox building layers to avoid conflicts
    const layers = map.getStyle().layers ?? [];
    for (const layer of layers) {
      if (
        (layer as { 'source-layer'?: string })['source-layer'] === 'building' &&
        layer.id !== BUILDING_LAYER &&
        layer.id !== BUILDING_HIGHLIGHT_LAYER
      ) {
        map.setLayoutProperty(layer.id, 'visibility', 'none');
      }
    }
    setMapLoaded(true);
  }, []);

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

  const cursor = insideBuilding && mode === 'edit' ? (activeTool ? 'crosshair' : 'default') : '';

  // Build highlight filter
  const highlightFilter: any = selectedBuildingId
    ? ['==', ['id'], Number(selectedBuildingId) || 0]
    : ['==', 'extrude', 'false_placeholder'];

  return (
    <Map
      ref={mapRef}
      initialViewState={INITIAL_VIEW}
      mapboxAccessToken={MAPBOX_TOKEN}
      mapStyle="mapbox://styles/mapbox/streets-v12"
      antialias
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
        showUserHeading
      />

      {/* 3D Building extrusion layer */}
      <Source id="composite" type="vector" url="mapbox://mapbox.mapbox-streets-v8">
        <Layer
          id={BUILDING_LAYER}
          type="fill-extrusion"
          source-layer="building"
          filter={['==', 'extrude', 'true']}
          minzoom={15}
          paint={{
            'fill-extrusion-color': '#aaa',
            'fill-extrusion-height': ['get', 'height'],
            'fill-extrusion-base': ['get', 'min_height'],
            'fill-extrusion-opacity': insideBuilding ? 0.15 : 0.6,
          }}
        />
        <Layer
          id={BUILDING_HIGHLIGHT_LAYER}
          type="fill-extrusion"
          source-layer="building"
          filter={highlightFilter}
          minzoom={15}
          paint={{
            'fill-extrusion-color': '#ff5722',
            'fill-extrusion-height': ['get', 'height'],
            'fill-extrusion-base': ['get', 'min_height'],
            'fill-extrusion-opacity': 0.8,
          }}
        />
      </Source>

      {/* Indoor editing layers (only when inside a building) */}
      {insideBuilding && <IndoorLayers />}

      {/* Entrance markers */}
      {insideBuilding && <EntranceLayers />}
    </Map>
  );
}
