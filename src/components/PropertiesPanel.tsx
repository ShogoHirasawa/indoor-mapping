import { useCallback } from 'react';
import { useMapStore } from '../store/useMapStore';

export default function PropertiesPanel() {
  const insideBuilding = useMapStore((s) => s.insideBuilding);
  const activeTool = useMapStore((s) => s.activeTool);
  const selectedObjectId = useMapStore((s) => s.selectedObjectId);
  const floors = useMapStore((s) => s.floors);
  const currentFloorIdx = useMapStore((s) => s.currentFloorIdx);

  // We need rotateSelectedTo from the editor hook.  Because it needs a mapRef,
  // but we're outside MapView here, we access the store directly and reimplement
  // a lightweight rotation that just calls store.updateObject.
  const updateObject = useMapStore((s) => s.updateObject);

  const floor = floors[currentFloorIdx] ?? null;
  const obj = floor?.objects.find((o) => o.id === selectedObjectId) ?? null;

  const handleRotate = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!obj) return;
      const targetAngle = parseInt(e.target.value, 10);
      const currentRotation = obj.props.rotation ?? 0;
      const delta = targetAngle - currentRotation;
      if (delta === 0) return;

      if (obj.type === 'Wall') {
        const coords = (obj.geometry as GeoJSON.LineString).coordinates;
        const mid = [(coords[0][0] + coords[1][0]) / 2, (coords[0][1] + coords[1][1]) / 2];
        const rad = (delta * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        const newCoords = coords.map((p: number[]) => {
          const dx = p[0] - mid[0];
          const dy = p[1] - mid[1];
          return [mid[0] + dx * cos - dy * sin, mid[1] + dx * sin + dy * cos];
        });
        updateObject(obj.id, {
          geometry: { type: 'LineString', coordinates: newCoords },
          props: { rotation: targetAngle },
        });
      } else if (obj.type === 'Stair') {
        const coords = (obj.geometry as GeoJSON.Polygon).coordinates;
        const ring = coords[0];
        const n = ring.length - 1;
        let cx = 0, cy = 0;
        for (let i = 0; i < n; i++) { cx += ring[i][0]; cy += ring[i][1]; }
        cx /= n; cy /= n;
        const rad = (delta * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        const newCoords = coords.map((r: number[][]) =>
          r.map((p: number[]) => {
            const dx = p[0] - cx;
            const dy = p[1] - cy;
            return [cx + dx * cos - dy * sin, cy + dx * sin + dy * cos];
          }),
        );
        updateObject(obj.id, {
          geometry: { type: 'Polygon', coordinates: newCoords },
          props: { rotation: targetAngle },
        });
      } else {
        updateObject(obj.id, { props: { rotation: targetAngle } });
      }
    },
    [obj, updateObject],
  );

  if (!insideBuilding) return null;

  // Contextual help text when no object is selected
  let helpText = 'Select a tool from the left panel, then click on the map to place objects.';
  if (activeTool === 'Wall') helpText = 'Click two points on the map to draw a wall.';
  else if (activeTool === 'Door') helpText = 'Click on an existing wall to place a door.';
  else if (activeTool === 'Stair') helpText = 'Click on the floor to place a stair.';
  else if (activeTool === 'Elevator') helpText = 'Click on the floor to place an elevator.';

  const rotation = obj?.props.rotation ?? 0;

  return (
    <div id="right-panel" className="visible">
      <div className="panel-title">Properties</div>
      <div id="props-content">
        {obj ? (
          <>
            <div className="prop-row">
              <span className="prop-label">ID</span>
              <span className="prop-value">{obj.id.substring(0, 8)}...</span>
            </div>
            <div className="prop-row">
              <span className="prop-label">Type</span>
              <span className="prop-value">{obj.type}</span>
            </div>
            {obj.props.wallId && (
              <div className="prop-row">
                <span className="prop-label">Wall ID</span>
                <span className="prop-value">{String(obj.props.wallId).substring(0, 8)}...</span>
              </div>
            )}
          </>
        ) : (
          <p className="no-selection">{helpText}</p>
        )}
      </div>

      <div id="rotate-control">
        <div className="rotate-header">
          <span className="prop-label">Rotation</span>
          <span className="prop-value">{rotation}°</span>
        </div>
        <input
          type="range"
          id="rotate-slider"
          min={0}
          max={359}
          step={1}
          value={rotation}
          disabled={!obj}
          onChange={handleRotate}
        />
      </div>
    </div>
  );
}
