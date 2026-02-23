import type { Position } from '../types';
import { SNAP_GRID_INTERVAL } from '../config';

/** Snap a coordinate [lng, lat] to the grid if snap is enabled */
export function snapCoord(coord: Position, enabled: boolean): Position {
  if (!enabled) return coord;
  const g = SNAP_GRID_INTERVAL;
  return [Math.round(coord[0] / g) * g, Math.round(coord[1] / g) * g];
}
