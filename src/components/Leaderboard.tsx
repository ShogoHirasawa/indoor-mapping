import { useState } from 'react';

interface LeaderboardEntry {
  rank: number;
  name: string;
  avatar: string;
  buildings: number;
  floors: number;
  score: number;
}

const DUMMY_DATA: LeaderboardEntry[] = [
  { rank: 1, name: 'Yuki Tanaka', avatar: 'YT', buildings: 42, floors: 186, score: 12480 },
  { rank: 2, name: 'Alex Chen', avatar: 'AC', buildings: 38, floors: 154, score: 10920 },
  { rank: 3, name: 'Maria Garcia', avatar: 'MG', buildings: 35, floors: 142, score: 9870 },
  { rank: 4, name: 'James Wilson', avatar: 'JW', buildings: 29, floors: 118, score: 8340 },
  { rank: 5, name: 'Sakura Ito', avatar: 'SI', buildings: 27, floors: 105, score: 7650 },
  { rank: 6, name: 'David Kim', avatar: 'DK', buildings: 24, floors: 96, score: 6720 },
  { rank: 7, name: 'Emma Brown', avatar: 'EB', buildings: 21, floors: 88, score: 5940 },
  { rank: 8, name: 'Ren Nakamura', avatar: 'RN', buildings: 19, floors: 76, score: 5280 },
  { rank: 9, name: 'Sophie Martin', avatar: 'SM', buildings: 16, floors: 64, score: 4410 },
  { rank: 10, name: 'Takeshi Yamada', avatar: 'TY', buildings: 14, floors: 52, score: 3780 },
];

const CURRENT_USER: LeaderboardEntry = {
  rank: 15,
  name: 'You',
  avatar: 'ME',
  buildings: 8,
  floors: 28,
  score: 1960,
};

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

interface LeaderboardProps {
  open: boolean;
  onClose: () => void;
}

export default function Leaderboard({ open, onClose }: LeaderboardProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('weekly');

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
          <span className="lb-col-stat">Buildings</span>
          <span className="lb-col-stat">Floors</span>
          <span className="lb-col-score">Score</span>
        </div>

        {/* Rows */}
        <div className="lb-list">
          {DUMMY_DATA.map((entry) => (
            <div
              key={entry.rank}
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
                  {entry.avatar}
                </span>
                <span className="lb-name">{entry.name}</span>
              </span>
              <span className="lb-col-stat">{entry.buildings}</span>
              <span className="lb-col-stat">{entry.floors}</span>
              <span className="lb-col-score">
                {entry.score.toLocaleString()}
              </span>
            </div>
          ))}
        </div>

        {/* Current user (sticky footer) */}
        <div className="lb-current-user">
          <div className="lb-row lb-row-me">
            <span className="lb-col-rank">{CURRENT_USER.rank}</span>
            <span className="lb-col-user">
              <span className="lb-avatar lb-avatar-me">{CURRENT_USER.avatar}</span>
              <span className="lb-name">{CURRENT_USER.name}</span>
            </span>
            <span className="lb-col-stat">{CURRENT_USER.buildings}</span>
            <span className="lb-col-stat">{CURRENT_USER.floors}</span>
            <span className="lb-col-score">
              {CURRENT_USER.score.toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
