import type { FloorDef } from './types';

export const DEFAULT_FLOOR_INDEX = 0; // 1F (dynamic floors start at index 0)

/** Generate floor definitions from the number of above-ground levels */
export function generateFloors(aboveGroundLevels: number): FloorDef[] {
  const floors: FloorDef[] = [];
  for (let i = 1; i <= aboveGroundLevels; i++) {
    floors.push({
      index: `${i}F`,
      elevation: (i - 1) * FLOOR_HEIGHT,
      label: `${i}F`,
    });
  }
  return floors;
}

export const FLOOR_HEIGHT = 4; // metres

/** Grid snap interval in degrees (~5 m at mid-latitudes) */
export const SNAP_GRID_INTERVAL = 0.00005;

/** Colour palette */
export const COLORS = {
  floor: '#f7f4f0',
  floorOutline: '#999',
  wall: '#333333',
  wallFill: '#d0d0d0',
  wallSelected: '#1a73e8',
  wallPreview: '#999999',
  door: '#d4a017',
  doorSelected: '#ff9800',
  stair: '#8bc34a',
  stairSelected: '#4caf50',
  elevator: '#2196f3',
  elevatorSelected: '#0d47a1',
  restroom: '#607d8b',
  restroomSelected: '#37474f',
  info: '#ff9800',
  infoSelected: '#e65100',
  selectedOutline: '#1a73e8',
} as const;

/** Map icon IDs to image filenames in public/ */
export const POI_ICON_MAP: Record<string, string> = {
  'icon-door': 'icons/door.png',
  'icon-stair': 'icons/stairs.png',
  'icon-elevator': 'icons/elevator.png',
  'icon-restroom': 'icons/toilet.png',
  'icon-info': 'icons/information.png',
};

/** ObjectType → icon image ID */
export const OBJECT_TYPE_ICON: Record<string, string> = {
  Door: 'icon-door',
  Stair: 'icon-stair',
  Elevator: 'icon-elevator',
  Restroom: 'icon-restroom',
  Info: 'icon-info',
};
