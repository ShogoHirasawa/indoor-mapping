import { useCallback } from 'react';
import { useMapStore } from '../store/useMapStore';
import { buildExportPayload, downloadJson } from '../utils/exportJson';

interface ToolbarProps {
  onOpenLeaderboard: () => void;
}

export default function Toolbar({ onOpenLeaderboard }: ToolbarProps) {
  const insideBuilding = useMapStore((s) => s.insideBuilding);
  const mode = useMapStore((s) => s.mode);
  const setMode = useMapStore((s) => s.setMode);
  const exitBuilding = useMapStore((s) => s.exitBuilding);
  const setTool = useMapStore((s) => s.setTool);
  const floors = useMapStore((s) => s.floors);
  const buildingId = useMapStore((s) => s.buildingId);

  const toggleMode = useCallback(() => {
    const next = mode === 'browse' ? 'edit' : 'browse';
    setMode(next);
    if (next === 'browse') setTool(null);
  }, [mode, setMode, setTool]);

  const handleExport = useCallback(() => {
    const payload = buildExportPayload(buildingId, floors);
    downloadJson(payload);
  }, [buildingId, floors]);

  return (
    <div id="toolbar">
      <button
        className={`toolbar-btn${mode === 'edit' ? ' edit-mode' : ''}`}
        onClick={toggleMode}
      >
        Mode: {mode === 'edit' ? 'Edit' : 'Browse'}
      </button>

      <button className="toolbar-btn lb-btn" onClick={onOpenLeaderboard}>
        Leaderboard
      </button>

      <div className="toolbar-divider" />

      {insideBuilding && (
        <>
          <button className="toolbar-btn exit-btn" onClick={exitBuilding}>
            Exit Building
          </button>
          <button className="toolbar-btn export-btn" onClick={handleExport}>
            Export JSON
          </button>
        </>
      )}
    </div>
  );
}
