import { create } from 'zustand';
import type {
  AppMode,
  ObjectType,
  IndoorObject,
  FloorData,
  UndoEntry,
  Geometry,
  Polygon,
  IndoorObjectProps,
} from '../types';
import { FLOORS, DEFAULT_FLOOR_INDEX } from '../config';
import { uuid } from '../utils/geometry';

const MAX_UNDO = 50;

// ── State shape ──────────────────────────────────────────────
export interface MapState {
  // Building
  buildingId: string | null;
  buildingFootprint: Geometry | null;
  insideBuilding: boolean;

  // Floors
  currentFloorIdx: number;
  floors: FloorData[];

  // Editing
  mode: AppMode;
  activeTool: ObjectType | null;
  snapEnabled: boolean;
  selectedObjectId: string | null;

  // Undo
  undoStack: UndoEntry[];

  // Toast
  toastMessage: string | null;

  // ── Actions ──
  enterBuilding: (id: string, footprint: Geometry) => void;
  exitBuilding: () => void;
  setFloor: (idx: number) => void;
  setFloorPolygon: (polygon: Polygon) => void;
  setMode: (mode: AppMode) => void;
  setTool: (tool: ObjectType | null) => void;
  setSnapEnabled: (enabled: boolean) => void;
  addObject: (
    type: ObjectType,
    geometry: Geometry,
    props?: Partial<IndoorObjectProps>,
  ) => IndoorObject;
  removeObject: (id: string) => void;
  updateObject: (id: string, updates: { geometry?: Geometry; props?: Partial<IndoorObjectProps> }) => void;
  selectObject: (id: string | null) => void;
  undo: () => boolean;
  showToast: (msg: string) => void;
  clearToast: () => void;
  // Helpers (read-only getters computed from state)
  getCurrentFloor: () => FloorData | null;
  getCurrentObjects: () => IndoorObject[];
  getSelectedObject: () => IndoorObject | null;
  getObject: (id: string) => IndoorObject | null;
}

// ── Store ────────────────────────────────────────────────────
export const useMapStore = create<MapState>((set, get) => ({
  // ── Initial state ──
  buildingId: null,
  buildingFootprint: null,
  insideBuilding: false,

  currentFloorIdx: DEFAULT_FLOOR_INDEX,
  floors: [],

  mode: 'browse',
  activeTool: null,
  snapEnabled: false,
  selectedObjectId: null,

  undoStack: [],

  toastMessage: null,

  // ── Actions ──────────────────────────────────────────────

  enterBuilding: (id, footprint) =>
    set({
      buildingId: id,
      buildingFootprint: footprint,
      insideBuilding: true,
      currentFloorIdx: DEFAULT_FLOOR_INDEX,
      selectedObjectId: null,
      undoStack: [],
      mode: 'edit',
      floors: FLOORS.map((f) => ({
        floorIndex: f.index,
        elevation: f.elevation,
        floorPolygon: null,
        objects: [],
      })),
    }),

  exitBuilding: () =>
    set({
      buildingId: null,
      buildingFootprint: null,
      insideBuilding: false,
      floors: [],
      selectedObjectId: null,
      undoStack: [],
      mode: 'browse',
      activeTool: null,
    }),

  setFloor: (idx) =>
    set({ currentFloorIdx: idx, selectedObjectId: null }),

  setFloorPolygon: (polygon) =>
    set((state) => {
      const floors = [...state.floors];
      const floor = { ...floors[state.currentFloorIdx] };
      floor.floorPolygon = polygon;
      floors[state.currentFloorIdx] = floor;
      return { floors };
    }),

  setMode: (mode) => set({ mode }),

  setTool: (tool) => set({ activeTool: tool }),

  setSnapEnabled: (enabled) => set({ snapEnabled: enabled }),

  addObject: (type, geometry, extraProps) => {
    const obj: IndoorObject = {
      id: uuid(),
      type,
      geometry,
      props: { rotation: 0, ...extraProps },
    };
    set((state) => {
      const floors = structuredClone(state.floors);
      const floor = floors[state.currentFloorIdx];
      if (!floor) return {};
      // push undo
      const undoStack = [
        ...state.undoStack,
        { floorIdx: state.currentFloorIdx, snapshot: structuredClone(state.floors[state.currentFloorIdx].objects) },
      ].slice(-MAX_UNDO);
      floor.objects = [...floor.objects, obj];
      return { floors, undoStack };
    });
    return obj;
  },

  removeObject: (id) =>
    set((state) => {
      const floors = structuredClone(state.floors);
      const floor = floors[state.currentFloorIdx];
      if (!floor) return {};
      const idx = floor.objects.findIndex((o) => o.id === id);
      if (idx === -1) return {};
      const undoStack = [
        ...state.undoStack,
        { floorIdx: state.currentFloorIdx, snapshot: structuredClone(state.floors[state.currentFloorIdx].objects) },
      ].slice(-MAX_UNDO);
      floor.objects.splice(idx, 1);
      const selectedObjectId = state.selectedObjectId === id ? null : state.selectedObjectId;
      return { floors, undoStack, selectedObjectId };
    }),

  updateObject: (id, updates) =>
    set((state) => {
      const floors = structuredClone(state.floors);
      const floor = floors[state.currentFloorIdx];
      if (!floor) return {};
      const obj = floor.objects.find((o) => o.id === id);
      if (!obj) return {};
      const undoStack = [
        ...state.undoStack,
        { floorIdx: state.currentFloorIdx, snapshot: structuredClone(state.floors[state.currentFloorIdx].objects) },
      ].slice(-MAX_UNDO);
      if (updates.geometry) obj.geometry = updates.geometry;
      if (updates.props) Object.assign(obj.props, updates.props);
      return { floors, undoStack };
    }),

  selectObject: (id) => set({ selectedObjectId: id }),

  undo: () => {
    const state = get();
    if (state.undoStack.length === 0) return false;
    const entry = state.undoStack[state.undoStack.length - 1];
    set((s) => {
      const floors = structuredClone(s.floors);
      const floor = floors[entry.floorIdx];
      if (!floor) return {};
      floor.objects = entry.snapshot;
      return {
        floors,
        undoStack: s.undoStack.slice(0, -1),
        selectedObjectId: null,
      };
    });
    return true;
  },

  showToast: (msg) => set({ toastMessage: msg }),
  clearToast: () => set({ toastMessage: null }),

  // ── Getters ──
  getCurrentFloor: () => {
    const s = get();
    return s.floors[s.currentFloorIdx] ?? null;
  },

  getCurrentObjects: () => {
    const s = get();
    const floor = s.floors[s.currentFloorIdx];
    return floor ? floor.objects : [];
  },

  getSelectedObject: () => {
    const s = get();
    if (!s.selectedObjectId) return null;
    const floor = s.floors[s.currentFloorIdx];
    return floor?.objects.find((o) => o.id === s.selectedObjectId) ?? null;
  },

  getObject: (id) => {
    const s = get();
    const floor = s.floors[s.currentFloorIdx];
    return floor?.objects.find((o) => o.id === id) ?? null;
  },
}));
