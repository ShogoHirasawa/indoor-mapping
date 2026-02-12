import { useCallback } from 'react';
import { FLOORS, DEFAULT_FLOOR_INDEX } from '../config';
import { useMapStore } from '../store/useMapStore';
import { useBuilding } from '../hooks/useBuilding';

export default function FloorSlider() {
  const insideBuilding = useMapStore((s) => s.insideBuilding);
  const currentFloorIdx = useMapStore((s) => s.currentFloorIdx);
  const setFloor = useMapStore((s) => s.setFloor);
  const { regenerateFloor } = useBuilding();

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const idx = parseInt(e.target.value, 10);
      setFloor(idx);
      // Re-generate floor polygon for the new floor
      regenerateFloor();
    },
    [setFloor, regenerateFloor],
  );

  if (!insideBuilding) return null;

  return (
    <div id="floor-slider-container" className="visible">
      <div id="floor-label">{FLOORS[currentFloorIdx].label}</div>
      <input
        type="range"
        id="floor-slider"
        min={0}
        max={FLOORS.length - 1}
        step={1}
        value={currentFloorIdx}
        onChange={handleChange}
      />
      <div className="floor-labels">
        {FLOORS.map((f) => (
          <span key={f.index}>{f.label}</span>
        ))}
      </div>
    </div>
  );
}
