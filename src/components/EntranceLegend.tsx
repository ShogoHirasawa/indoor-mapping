import { useMapStore } from '../store/useMapStore';
import { useEntrance } from '../hooks/useEntrance';

export default function EntranceLegend() {
  const insideBuilding = useMapStore((s) => s.insideBuilding);
  const mode = useMapStore((s) => s.mode);
  const currentFloorIdx = useMapStore((s) => s.currentFloorIdx);

  // Only show when inside a building, in edit mode, on 1F
  if (!insideBuilding || mode !== 'edit' || currentFloorIdx !== 2) return null;

  return (
    <div className="entrance-legend">
      <img
        src={`${import.meta.env.BASE_URL}entrance-icon.png`}
        alt="Entrance"
        className="entrance-legend-icon"
      />
      <span>Entrance</span>
    </div>
  );
}
