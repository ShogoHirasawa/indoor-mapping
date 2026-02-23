import { useState, useRef, useEffect, useCallback } from 'react';
import { useMap } from 'react-map-gl/maplibre';

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  type: string;
  class: string;
}

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const DEBOUNCE_MS = 400;
const MIN_QUERY_LENGTH = 3;

export default function SearchBar() {
  const { current: mapInstance } = useMap();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const search = useCallback(async (q: string) => {
    abortRef.current?.abort();
    if (q.length < MIN_QUERY_LENGTH) {
      setResults([]);
      setOpen(false);
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);

    try {
      const params = new URLSearchParams({
        q,
        format: 'json',
        limit: '5',
        addressdetails: '0',
      });
      const resp = await fetch(`${NOMINATIM_URL}?${params}`, {
        signal: controller.signal,
        headers: { 'Accept-Language': 'ja,en' },
      });
      if (!resp.ok) return;
      const data: NominatimResult[] = await resp.json();
      setResults(data);
      setOpen(data.length > 0);
      setActiveIdx(-1);
    } catch {
      /* aborted or network error */
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInput = useCallback(
    (value: string) => {
      setQuery(value);
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => search(value.trim()), DEBOUNCE_MS);
    },
    [search],
  );

  const flyTo = useCallback(
    (lat: number, lon: number) => {
      const map = mapInstance?.getMap();
      if (!map) return;
      map.flyTo({ center: [lon, lat], zoom: 17, pitch: 60, duration: 2000 });
    },
    [mapInstance],
  );

  const selectResult = useCallback(
    (r: NominatimResult) => {
      flyTo(parseFloat(r.lat), parseFloat(r.lon));
      setQuery(r.display_name.split(',')[0]);
      setOpen(false);
      inputRef.current?.blur();
    },
    [flyTo],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!open) return;
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setActiveIdx((prev) => Math.min(prev + 1, results.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setActiveIdx((prev) => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (activeIdx >= 0 && results[activeIdx]) selectResult(results[activeIdx]);
          break;
        case 'Escape':
          setOpen(false);
          inputRef.current?.blur();
          break;
      }
    },
    [open, activeIdx, results, selectResult],
  );

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  return (
    <div ref={containerRef} className="search-container">
      <div className="search-input-wrap">
        <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          ref={inputRef}
          className="search-input"
          type="text"
          placeholder="Search location..."
          value={query}
          onChange={(e) => handleInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setOpen(true)}
        />
        {loading && <span className="search-spinner" />}
        {query && !loading && (
          <button
            className="search-clear"
            onClick={() => {
              setQuery('');
              setResults([]);
              setOpen(false);
              inputRef.current?.focus();
            }}
          >
            &times;
          </button>
        )}
      </div>

      {open && (
        <ul className="search-results">
          {results.map((r, i) => (
            <li
              key={r.place_id}
              className={`search-result-item${i === activeIdx ? ' active' : ''}`}
              onMouseEnter={() => setActiveIdx(i)}
              onClick={() => selectResult(r)}
            >
              <span className="search-result-name">
                {r.display_name.split(',')[0]}
              </span>
              <span className="search-result-detail">
                {r.display_name.split(',').slice(1, 3).join(',')}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
