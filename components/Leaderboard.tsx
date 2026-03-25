import { useState, useEffect } from 'react';

interface LeaderboardEntry {
  rank: number;
  userId: string;
  name: string;
  features: number;
}

type TabKey = 'weekly' | 'monthly' | 'alltime';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'weekly', label: 'Weekly' },
  { key: 'monthly', label: 'Monthly' },
  { key: 'alltime', label: 'All Time' },
];

function medalForRank(rank: number): string {
  if (rank === 1) return '\u{1F947}';
  if (rank === 2) return '\u{1F948}';
  if (rank === 3) return '\u{1F949}';
  return '';
}

function avatarInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

interface LeaderboardProps {
  open: boolean;
  onClose: () => void;
}

export default function Leaderboard({ open, onClose }: LeaderboardProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('weekly');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [currentUser, setCurrentUser] = useState<LeaderboardEntry | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch(`/api/leaderboard?period=${activeTab}`)
      .then((r) => r.json())
      .then((data) => {
        setEntries(data.leaderboard ?? []);
        setCurrentUser(data.currentUser ?? null);
      })
      .catch(() => {
        setEntries([]);
        setCurrentUser(null);
      })
      .finally(() => setLoading(false));
  }, [open, activeTab]);

  if (!open) return null;

  return (
    <div className="lb-overlay" onClick={onClose}>
      <div className="lb-panel" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="lb-header">
          <h2 className="lb-title">Leaderboard</h2>
          <button className="lb-close" onClick={onClose} aria-label="Close">
            &times;
          </button>
        </div>

        {/* Tabs */}
        <div className="lb-tabs">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              className={`lb-tab${activeTab === tab.key ? ' active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Table header */}
        <div className="lb-table-header">
          <span className="lb-col-rank">#</span>
          <span className="lb-col-user">User</span>
          <span className="lb-col-score">Features</span>
        </div>

        {/* Rows */}
        <div className="lb-list">
          {loading ? (
            <div className="lb-loading">Loading...</div>
          ) : entries.length === 0 ? (
            <div className="lb-loading">No data yet</div>
          ) : (
            entries.map((entry) => (
              <div
                key={entry.userId}
                className={`lb-row${entry.rank <= 3 ? ' lb-top3' : ''}`}
              >
                <span className="lb-col-rank">
                  {medalForRank(entry.rank) || entry.rank}
                </span>
                <span className="lb-col-user">
                  <span
                    className="lb-avatar"
                    data-rank={entry.rank <= 3 ? entry.rank : undefined}
                  >
                    {avatarInitials(entry.name)}
                  </span>
                  <span className="lb-name">{entry.name}</span>
                </span>
                <span className="lb-col-score">
                  {entry.features.toLocaleString()}
                </span>
              </div>
            ))
          )}
        </div>

        {/* Current user (sticky footer) */}
        {currentUser && (
          <div className="lb-current-user">
            <div className="lb-row lb-row-me">
              <span className="lb-col-rank">{currentUser.rank}</span>
              <span className="lb-col-user">
                <span className="lb-avatar lb-avatar-me">
                  {avatarInitials(currentUser.name)}
                </span>
                <span className="lb-name">{currentUser.name}</span>
              </span>
              <span className="lb-col-score">
                {currentUser.features.toLocaleString()}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
