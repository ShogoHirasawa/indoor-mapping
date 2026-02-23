import { useCallback } from 'react';
import { useMapStore } from '../store/useMapStore';
import { useBuilding } from '../hooks/useBuilding';

export default function FloorSlider() {
  const insideBuilding = useMapStore((s) => s.insideBuilding);
  const currentFloorIdx = useMapStore((s) => s.currentFloorIdx);
  const floors = useMapStore((s) => s.floors);
  const setFloor = useMapStore((s) => s.setFloor);
  const { regenerateFloor } = useBuilding();

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const idx = parseInt(e.target.value, 10);
      setFloor(idx);
      regenerateFloor();
    },
    [setFloor, regenerateFloor],
  );

  if (!insideBuilding || floors.length === 0) return null;

  return (
    <div id="floor-slider-container" className="visible">
      <div id="floor-label">{floors[currentFloorIdx]?.floorIndex ?? ''}</div>
      <input
        type="range"
        id="floor-slider"
        min={0}
        max={floors.length - 1}
        step={1}
        value={currentFloorIdx}
        onChange={handleChange}
      />
      <div className="floor-labels">
        {floors.map((f) => (
          <span key={f.floorIndex}>{f.floorIndex}</span>
        ))}
      </div>
    </div>
  );
}
