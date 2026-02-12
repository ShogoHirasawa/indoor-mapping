import { useState, useCallback } from 'react';
import type { Geometry, EntrancePoint, Position } from '../types';
import { MAPBOX_TOKEN } from '../env';
import { centroid } from '../utils/geometry';

/**
 * Fetch and manage building entrance data from Mapbox Geocoding API.
 * Entrances are only shown on 1F (floorIdx === 2).
 */
export function useEntrance() {
  const [entranceData, setEntranceData] = useState<EntrancePoint[]>([]);
  const [visible, setVisible] = useState(false);

  /** Fetch entrance data for a building footprint */
  const fetchEntrances = useCallback(async (footprint: Geometry) => {
    setEntranceData([]);

    let center: Position;
    if (footprint.type === 'Polygon') {
      center = centroid(footprint.coordinates as Position[][]);
    } else if (footprint.type === 'MultiPolygon') {
      center = centroid(footprint.coordinates[0] as Position[][]);
    } else {
      return;
    }

    const [lng, lat] = center;
    const url =
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json` +
      `?access_token=${MAPBOX_TOKEN}` +
      `&entrances=true&types=address&limit=1`;

    try {
      const resp = await fetch(url);
      if (!resp.ok) {
        console.warn('[Entrance] Geocoding API returned', resp.status);
        return;
      }
      const data = await resp.json();

      const points: EntrancePoint[] = [];

      // Extract the routable_points array from a feature.
      // The API returns varying structures:
      //   - feature.routable_points.points    (object with .points array)
      //   - feature.routable_points           (direct array — blog example)
      //   - feature.properties.routable_points.points
      //   - feature.properties.routable_points (direct array)
      const extractRoutablePoints = (feature: any): any[] => {
        const candidates = [
          feature.routable_points?.points,
          feature.routable_points,
          feature.properties?.routable_points?.points,
          feature.properties?.routable_points,
        ];
        for (const c of candidates) {
          if (Array.isArray(c)) return c;
        }
        return [];
      };

      // Extract lng/lat from a routable point.
      // API v5 uses coordinates:[lng,lat], blog example uses longitude/latitude.
      const getLngLat = (rp: any): { lng: number; lat: number } | null => {
        if (Array.isArray(rp.coordinates) && rp.coordinates.length >= 2) {
          return { lng: rp.coordinates[0], lat: rp.coordinates[1] };
        }
        if (typeof rp.longitude === 'number' && typeof rp.latitude === 'number') {
          return { lng: rp.longitude, lat: rp.latitude };
        }
        return null;
      };

      if (data.features?.length) {
        for (const feature of data.features) {
          const routablePoints = extractRoutablePoints(feature);

          for (const rp of routablePoints) {
            // Match "entrance" or names containing "entrance"
            if (typeof rp.name === 'string' && rp.name.toLowerCase().includes('entrance')) {
              const pos = getLngLat(rp);
              if (pos) {
                points.push({ lng: pos.lng, lat: pos.lat, accuracy: rp.accuracy ?? 'unknown' });
              }
            }
          }
        }

        // Fallback: use "default" / "default_routable_point" if no entrances
        if (points.length === 0) {
          const routablePoints = extractRoutablePoints(data.features[0]);
          for (const rp of routablePoints) {
            if (typeof rp.name === 'string' && rp.name.toLowerCase().includes('default')) {
              const pos = getLngLat(rp);
              if (pos) {
                points.push({ lng: pos.lng, lat: pos.lat, accuracy: 'default' });
              }
            }
          }
        }
      }

      setEntranceData(points);
    } catch (err) {
      console.error('[Entrance] fetch error:', err);
    }
  }, []);

  /** Show entrance markers */
  const showEntrances = useCallback(() => setVisible(true), []);

  /** Hide entrance markers */
  const hideEntrances = useCallback(() => setVisible(false), []);

  /** Clear data + hide */
  const clearEntrances = useCallback(() => {
    setEntranceData([]);
    setVisible(false);
  }, []);

  return {
    entranceData,
    entranceVisible: visible && entranceData.length > 0,
    fetchEntrances,
    showEntrances,
    hideEntrances,
    clearEntrances,
  };
}
