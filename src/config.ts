import type { FloorDef, ObjectType } from './types';

export const FLOORS: FloorDef[] = [
  { index: 'B2', elevation: -8, label: 'B2' },
  { index: 'B1', elevation: -4, label: 'B1' },
  { index: '1F', elevation: 0, label: '1F' },
  { index: '2F', elevation: 4, label: '2F' },
];

export const DEFAULT_FLOOR_INDEX = 2; // 1F

export const FLOOR_HEIGHT = 4; // metres

export const FLOOR_SLAB_THICKNESS = 0.15; // metres

/** Grid snap interval in degrees (~5 m at mid-latitudes) */
export const SNAP_GRID_INTERVAL = 0.00005;

/** Stair default size in degrees (~3 m × 5 m) */
export const STAIR_WIDTH = 0.00003;
export const STAIR_LENGTH = 0.00005;

/** Colour palette */
export const COLORS = {
  floor: '#e0e0e0',
  floorOutline: '#999999',
  wall: '#333333',
  wallSelected: '#1a73e8',
  wallPreview: '#999999',
  door: '#d4a017',
  doorSelected: '#ff9800',
  stair: '#8bc34a',
  stairSelected: '#4caf50',
  elevator: '#2196f3',
  elevatorSelected: '#0d47a1',
  buildingHighlight: '#ff5722',
  selectedOutline: '#1a73e8',
} as const;

export const OBJECT_TYPES: Record<string, ObjectType> = {
  WALL: 'Wall',
  DOOR: 'Door',
  STAIR: 'Stair',
  ELEVATOR: 'Elevator',
};
