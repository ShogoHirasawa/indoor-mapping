import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useMapStore } from '../store/useMapStore';
import { useIndoorSync } from '../hooks/useIndoorSync';
import { buildExportPayload, downloadJson } from '../utils/exportJson';
import { createClient } from '@/utils/supabase/client';

interface ToolbarProps {
  onOpenLeaderboard: () => void;
}

export default function Toolbar({ onOpenLeaderboard }: ToolbarProps) {
  const [username, setUsername] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const insideBuilding = useMapStore((s) => s.insideBuilding);
  const { saveBuilding, isSaving } = useIndoorSync();
  const setMode = useMapStore((s) => s.setMode);

  useEffect(() => {
    const supabase = createClient();
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setIsLoggedIn(true);
      setMode('edit');
      const { data } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', user.id)
        .single();
      if (data?.username) setUsername(data.username);
    };
    load();
  }, [setMode]);
  const exitBuilding = useMapStore((s) => s.exitBuilding);
  const floors = useMapStore((s) => s.floors);
  const buildingId = useMapStore((s) => s.buildingId);

  const handleExport = useCallback(() => {
    const payload = buildExportPayload(buildingId, floors);
    downloadJson(payload);
  }, [buildingId, floors]);

  return (
    <div id="toolbar">
      {username ? (
        <Link href="/user" className="toolbar-username" title="User profile">
          {username}
        </Link>
      ) : !isLoggedIn ? (
        <>
          <Link href="/login" className="toolbar-btn">
            Log in
          </Link>
          <Link href="/login?signup=1" className="toolbar-btn">
            Sign up
          </Link>
        </>
      ) : null}

      {!insideBuilding && (
        <button className="toolbar-btn lb-btn" onClick={onOpenLeaderboard}>
          Leaderboard
        </button>
      )}

      <div className="toolbar-divider" />

      {insideBuilding && (
        <>
          {isLoggedIn && (
            <>
              <button
                className="toolbar-btn save-btn"
                onClick={saveBuilding}
                disabled={isSaving}
              >
                {isSaving ? 'Saving...' : 'Save'}
              </button>
              <button className="toolbar-btn export-btn" onClick={handleExport}>
                Export JSON
              </button>
            </>
          )}
          <button className="toolbar-btn exit-btn" onClick={exitBuilding}>
            Exit Building
          </button>
        </>
      )}
    </div>
  );
}
