import type { FloorData } from '../types';

export interface ExportPayload {
  buildingId: string | null;
  floors: {
    floorIndex: string;
    elevation: number;
    objects: {
      id: string;
      type: string;
      geometry: GeoJSON.Geometry;
      props: Record<string, unknown>;
    }[];
  }[];
}

/** Build the export payload from store state */
export function buildExportPayload(
  buildingId: string | null,
  floors: FloorData[],
): ExportPayload {
  return {
    buildingId,
    floors: floors.map((f) => ({
      floorIndex: f.floorIndex,
      elevation: f.elevation,
      objects: f.objects.map((o) => ({
        id: o.id,
        type: o.type,
        geometry: o.geometry,
        props: { ...o.props },
      })),
    })),
  };
}

/** Export building data as JSON: log to console and trigger download */
export function downloadJson(payload: ExportPayload): void {
  const json = JSON.stringify(payload, null, 2);
  console.log('=== Indoor Mapping JSON Export ===');
  console.log(json);

  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `indoor-map-${payload.buildingId || 'unknown'}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
