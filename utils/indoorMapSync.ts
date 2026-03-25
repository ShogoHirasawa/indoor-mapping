/**
 * Map between editor IndoorObject and API resources (spaces, openings, vertical_connectors, amenities).
 * Used when loading from API into store and when saving store to API.
 */

import type { IndoorObject, ObjectType } from '../types';
import type { Geometry } from 'geojson';

// ── API row types (minimal shape we need)
export interface ApiSpace {
  id: string;
  level_id: string;
  building_id: string;
  venue_id: string;
  name?: string | null;
  space_type: string;
  geom: Geometry | unknown;
}
export interface ApiOpening {
  id: string;
  level_id: string;
  building_id: string;
  venue_id: string;
  name?: string | null;
  opening_type: string;
  geom: Geometry | unknown;
}
export interface ApiVerticalConnector {
  id: string;
  level_id: string;
  building_id: string;
  venue_id: string;
  connector_type: string;
  geom: Geometry | unknown;
}
export interface ApiAmenity {
  id: string;
  level_id: string;
  building_id: string;
  venue_id: string;
  amenity_type: string;
  name?: string | null;
  geom: Geometry | unknown;
}

function hasCoordinates(g: object): g is Geometry & { coordinates: unknown } {
  return 'coordinates' in g && Array.isArray((g as { coordinates: unknown }).coordinates);
}

function isGeoJson(g: unknown): g is Geometry {
  if (typeof g !== 'object' || g === null) return false;
  if (!('type' in g) || typeof (g as { type: unknown }).type !== 'string') return false;
  if (!hasCoordinates(g)) return false;
  const t = (g as Geometry).type;
  return t === 'Point' || t === 'LineString' || t === 'Polygon' || t === 'MultiPolygon';
}

/** Parse API geom (GeoJSON object; WKB hex is converted server-side by API). */
function toGeom(g: unknown): Geometry | null {
  if (isGeoJson(g)) return g;
  return null;
}

/** space_type → ObjectType */
function spaceTypeToObjectType(spaceType: string): ObjectType {
  if (spaceType === 'corridor' || spaceType === 'passage') return 'Passage';
  return 'Wall';
}

/** opening_type → ObjectType (only door in editor) */
/** connector_type → ObjectType */
/** amenity_type → ObjectType */

/** Convert API space to IndoorObject */
export function apiSpaceToObject(row: ApiSpace): IndoorObject | null {
  const geom = toGeom(row.geom);
  if (!geom || (geom.type !== 'Polygon' && geom.type !== 'MultiPolygon')) return null;
  return {
    id: row.id,
    type: spaceTypeToObjectType(row.space_type),
    geometry: geom,
    props: {
      rotation: 0,
      __dbId: row.id,
      __dbTable: 'spaces',
    },
  };
}

/** Convert API opening to IndoorObject (Door) */
export function apiOpeningToObject(row: ApiOpening): IndoorObject | null {
  const geom = toGeom(row.geom);
  if (!geom) return null;
  return {
    id: row.id,
    type: 'Door',
    geometry: geom,
    props: {
      rotation: 0,
      __dbId: row.id,
      __dbTable: 'openings',
    },
  };
}

/** Convert API vertical_connector to IndoorObject (Stair | Elevator) */
export function apiConnectorToObject(row: ApiVerticalConnector): IndoorObject | null {
  const geom = toGeom(row.geom);
  if (!geom || geom.type !== 'Point') return null;
  const type: ObjectType = row.connector_type === 'elevator' ? 'Elevator' : 'Stair';
  return {
    id: row.id,
    type,
    geometry: geom,
    props: {
      rotation: 0,
      __dbId: row.id,
      __dbTable: 'vertical_connectors',
    },
  };
}

/** Convert API amenity to IndoorObject (Restroom | Info) */
export function apiAmenityToObject(row: ApiAmenity): IndoorObject | null {
  const geom = toGeom(row.geom);
  if (!geom || geom.type !== 'Point') return null;
  const type: ObjectType =
    row.amenity_type === 'restroom' || row.amenity_type === 'toilet'
      ? 'Restroom'
      : 'Info';
  return {
    id: row.id,
    type,
    geometry: geom,
    props: {
      rotation: 0,
      __dbId: row.id,
      __dbTable: 'amenities',
    },
  };
}

/** ObjectType → space_type (for spaces table) */
export function objectTypeToSpaceType(type: ObjectType): string {
  if (type === 'Passage') return 'corridor';
  return 'room';
}

/** ObjectType → opening_type (for openings table) */
export function objectTypeToOpeningType(type: ObjectType): string {
  return 'door';
}

/** ObjectType → connector_type (for vertical_connectors table) */
export function objectTypeToConnectorType(type: ObjectType): 'stairs' | 'elevator' {
  return type === 'Elevator' ? 'elevator' : 'stairs';
}

/** ObjectType → amenity_type (for amenities table) */
export function objectTypeToAmenityType(type: ObjectType): string {
  if (type === 'Restroom') return 'restroom';
  return 'information';
}

export function getDbTableForObjectType(type: ObjectType): ApiTable {
  if (type === 'Wall' || type === 'Passage') return 'spaces';
  if (type === 'Door') return 'openings';
  if (type === 'Stair' || type === 'Elevator') return 'vertical_connectors';
  return 'amenities';
}

export type ApiTable = 'spaces' | 'openings' | 'vertical_connectors' | 'amenities';
