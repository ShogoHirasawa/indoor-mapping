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
      if (!resp.ok) return;
      const data = await resp.json();

      const points: EntrancePoint[] = [];

      if (data.features?.length) {
        for (const feature of data.features) {
          const routablePoints: any[] =
            feature.properties?.routable_points?.points ?? feature.routable_points ?? [];

          for (const rp of routablePoints) {
            if (rp.name === 'entrance') {
              points.push({ lng: rp.longitude, lat: rp.latitude, accuracy: rp.accuracy ?? 'unknown' });
            }
          }
        }

        // Fallback to "default" routable point if no entrances found
        if (points.length === 0) {
          const feature = data.features[0];
          const rps: any[] =
            feature.properties?.routable_points?.points ?? feature.routable_points ?? [];
          for (const rp of rps) {
            if (rp.name === 'default') {
              points.push({ lng: rp.longitude, lat: rp.latitude, accuracy: 'default' });
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
