import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useMapStore } from '../store/useMapStore';
import { buildExportPayload, downloadJson } from '../utils/exportJson';
import { createClient } from '@/utils/supabase/client';

interface ToolbarProps {
  onOpenLeaderboard: () => void;
}

export default function Toolbar({ onOpenLeaderboard }: ToolbarProps) {
  const router = useRouter();
  const [username, setUsername] = useState<string | null>(null);
  const insideBuilding = useMapStore((s) => s.insideBuilding);

  useEffect(() => {
    const supabase = createClient();
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', user.id)
        .single();
      if (data?.username) setUsername(data.username);
    };
    load();
  }, []);
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
      {username && (
        <Link href="/user" className="toolbar-username" title="ユーザーページへ">
          {username}
        </Link>
      )}
      <button
        className={`toolbar-btn${mode === 'edit' ? ' edit-mode' : ''}`}
        onClick={toggleMode}
      >
        Mode: {mode === 'edit' ? 'Edit' : 'Browse'}
      </button>

      {!insideBuilding && (
        <button className="toolbar-btn lb-btn" onClick={onOpenLeaderboard}>
          Leaderboard
        </button>
      )}

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
