import { useCallback } from 'react';
import type { ObjectType } from '../types';
import { useMapStore } from '../store/useMapStore';

const base = import.meta.env.BASE_URL;

const TOOLS: { type: ObjectType; icon?: string; img?: string }[] = [
  { type: 'Wall', icon: '|' },
  { type: 'Door', img: `${base}icons/door.png` },
  { type: 'Stair', img: `${base}icons/stairs.png` },
  { type: 'Elevator', img: `${base}icons/elevator.png` },
  { type: 'Restroom', img: `${base}icons/toilet.png` },
  { type: 'Info', img: `${base}icons/information.png` },
];

export default function Palette() {
  const insideBuilding = useMapStore((s) => s.insideBuilding);
  const mode = useMapStore((s) => s.mode);
  const activeTool = useMapStore((s) => s.activeTool);
  const setTool = useMapStore((s) => s.setTool);
  const snapEnabled = useMapStore((s) => s.snapEnabled);
  const setSnapEnabled = useMapStore((s) => s.setSnapEnabled);
  const currentFloorIdx = useMapStore((s) => s.currentFloorIdx);

  const handleToolClick = useCallback(
    (type: ObjectType) => {
      setTool(activeTool === type ? null : type);
    },
    [activeTool, setTool],
  );

  if (!insideBuilding || mode !== 'edit') return null;

  return (
    <div id="left-panel" className="visible">
      <div className="panel-title">Components</div>

      {TOOLS.map((t) => (
        <button
          key={t.type}
          className={`tool-btn${activeTool === t.type ? ' active' : ''}`}
          onClick={() => handleToolClick(t.type)}
        >
          {t.img ? (
            <img src={t.img} alt={t.type} className="tool-icon-img" />
          ) : (
            <span className="tool-icon">{t.icon}</span>
          )}
          <span>{t.type}</span>
        </button>
      ))}

      <div className="snap-section">
        <label className="snap-label">
          <input
            type="checkbox"
            checked={snapEnabled}
            onChange={(e) => setSnapEnabled(e.target.checked)}
          />
          Grid Snap
        </label>
      </div>

      {/* Entrance legend — only on 1F */}
      {currentFloorIdx === 0 && (
        <div className="entrance-legend-inline">
          <div className="panel-title">Legend</div>
          <div className="entrance-legend-row">
            <img
              src={`${import.meta.env.BASE_URL}entrance-icon.png`}
              alt="Entrance"
              className="entrance-legend-icon"
            />
            <span>Entrance</span>
          </div>
        </div>
      )}
    </div>
  );
}
