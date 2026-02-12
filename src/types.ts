import type { Geometry, Position, Polygon, LineString, Point } from 'geojson';

// ---------- Object Types ----------
export type ObjectType = 'Wall' | 'Door' | 'Stair' | 'Elevator';

// ---------- Indoor Object ----------
export interface IndoorObjectProps {
  rotation: number;
  wallId?: string;
  [key: string]: unknown;
}

export interface IndoorObject {
  id: string;
  type: ObjectType;
  geometry: Geometry;
  props: IndoorObjectProps;
}

// ---------- Floor ----------
export interface FloorDef {
  index: string;   // 'B2' | 'B1' | '1F' | '2F'
  elevation: number;
  label: string;
}

export interface FloorData {
  floorIndex: string;
  elevation: number;
  floorPolygon: Polygon | null;
  objects: IndoorObject[];
}

// ---------- Undo ----------
export interface UndoEntry {
  floorIdx: number;
  snapshot: IndoorObject[];
}

// ---------- Entrance ----------
export interface EntrancePoint {
  lng: number;
  lat: number;
  accuracy: string;
}

// ---------- Mode ----------
export type AppMode = 'browse' | 'edit';

// ---------- Re-exports for convenience ----------
export type { Geometry, Position, Polygon, LineString, Point };
