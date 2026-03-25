'use client';

import { useCallback, useState } from 'react';
import type { Geometry } from 'geojson';
import { useMapStore } from '../store/useMapStore';
import {
  getIndoorContext,
  getIndoorList,
  getIndoorOne,
  postIndoor,
  patchIndoor,
} from '../utils/indoorApi';
import { polygonToMultiPolygonWkt, geometryToWkt } from '../utils/wkt';
import { createRectPolygon } from '../utils/geometry';
import {
  apiSpaceToObject,
  apiOpeningToObject,
  apiConnectorToObject,
  apiAmenityToObject,
  getDbTableForObjectType,
  objectTypeToSpaceType,
  objectTypeToOpeningType,
  objectTypeToConnectorType,
  objectTypeToAmenityType,
  type ApiSpace,
  type ApiOpening,
  type ApiVerticalConnector,
  type ApiAmenity,
} from '../utils/indoorMapSync';
import type { IndoorObject } from '../types';

export function useIndoorSync() {
  const enterBuilding = useMapStore((s) => s.enterBuilding);
  const setFloorObjects = useMapStore((s) => s.setFloorObjects);
  const updateObject = useMapStore((s) => s.updateObject);
  const buildingId = useMapStore((s) => s.buildingId);
  const venueId = useMapStore((s) => s.venueId);
  const organizationId = useMapStore((s) => s.organizationId);
  const floors = useMapStore((s) => s.floors);
  const buildingFootprint = useMapStore((s) => s.buildingFootprint);
  const showToast = useMapStore((s) => s.showToast);

  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  /**
   * Enter a building with DB: ensure venue, create building + levels, load spaces etc. into store.
   * externalId: e.g. OSM feature id, stored so map click on same building reopens it.
   */
  const enterBuildingWithDb = useCallback(
    async (
      footprint: Geometry,
      levelCount: number,
      buildingName?: string,
      externalId?: string,
    ): Promise<string | null> => {
      setIsLoading(true);
      try {
        const ctx = await getIndoorContext();
        if (!ctx.organizationId) {
          showToast('No organization found');
          return null;
        }
        let vid = ctx.venues[0]?.id;
        if (!vid) {
          const v = (await postIndoor('venues', {
            organization_id: ctx.organizationId,
            name: 'Default Venue',
          })) as { id: string };
          vid = v.id;
        }
        const buildingPayload = {
          venue_id: vid,
          name: buildingName ?? `Building ${Date.now()}`,
          footprint_geom: polygonToMultiPolygonWkt(footprint),
          external_id: externalId ?? null,
        };
        const building = (await postIndoor('buildings', buildingPayload)) as {
          id: string;
          venue_id: string;
        };
        let levelList = (await getIndoorList('levels', { building_id: building.id })) as {
          id: string;
          ordinal: number;
        }[];
        if (levelList.length === 0) {
          for (let i = 1; i <= levelCount; i++) {
            await postIndoor('levels', {
              building_id: building.id,
              name: `${i}F`,
              ordinal: i,
            });
          }
          levelList = (await getIndoorList('levels', { building_id: building.id })) as {
            id: string;
            ordinal: number;
          }[];
        }
        const levelIds = levelList.sort((a, b) => a.ordinal - b.ordinal).map((l) => l.id);
        enterBuilding(building.id, footprint, levelCount, {
          venueId: building.venue_id,
          organizationId: ctx.organizationId,
          levelIds,
        });
        for (let i = 0; i < levelIds.length; i++) {
          const levelId = levelIds[i];
          const objects: IndoorObject[] = [];
          const spaces = (await getIndoorList('spaces', { level_id: levelId })) as ApiSpace[];
          for (const row of spaces) {
            const obj = apiSpaceToObject(row);
            if (obj) objects.push(obj);
          }
          const openings = (await getIndoorList('openings', { level_id: levelId })) as ApiOpening[];
          for (const row of openings) {
            const obj = apiOpeningToObject(row);
            if (obj) objects.push(obj);
          }
          const connectors = (await getIndoorList('vertical_connectors', {
            building_id: building.id,
          })) as ApiVerticalConnector[];
          for (const row of connectors) {
            if (row.level_id !== levelId) continue;
            const obj = apiConnectorToObject(row);
            if (obj) objects.push(obj);
          }
          const amenities = (await getIndoorList('amenities', { level_id: levelId })) as ApiAmenity[];
          for (const row of amenities) {
            const obj = apiAmenityToObject(row);
            if (obj) objects.push(obj);
          }
          setFloorObjects(i, objects);
        }
        return building.id;
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Failed to load building';
        showToast(msg);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [
      enterBuilding,
      setFloorObjects,
      showToast,
    ]
  );

  /**
   * Load an existing building from DB by id and enter it in the editor.
   */
  const loadBuildingById = useCallback(
    async (buildingId: string): Promise<boolean> => {
      setIsLoading(true);
      try {
        const building = (await getIndoorOne('buildings', buildingId)) as {
          id: string;
          venue_id: string;
          footprint_geom?: { type: string; coordinates: unknown } | null;
        };
        const venue = (await getIndoorOne('venues', building.venue_id)) as {
          organization_id: string;
        };
        const organizationId = venue.organization_id;

        let footprint: Geometry = createRectPolygon(139.75, 35.68, 0.0002, 0.00015);
        const geom = building.footprint_geom;
        if (geom && (geom.type === 'Polygon' || geom.type === 'MultiPolygon')) {
          footprint = geom as Geometry;
        }

        let levelList = (await getIndoorList('levels', { building_id: building.id })) as {
          id: string;
          ordinal: number;
        }[];
        if (levelList.length === 0) {
          await postIndoor('levels', {
            building_id: building.id,
            name: '1F',
            ordinal: 1,
          });
          levelList = (await getIndoorList('levels', { building_id: building.id })) as {
            id: string;
            ordinal: number;
          }[];
        }
        const levelIds = levelList.sort((a, b) => a.ordinal - b.ordinal).map((l) => l.id);
        const levelCount = Math.max(1, levelIds.length);

        enterBuilding(building.id, footprint, levelCount, {
          venueId: building.venue_id,
          organizationId,
          levelIds,
        });

        for (let i = 0; i < levelIds.length; i++) {
          const levelId = levelIds[i];
          const objects: IndoorObject[] = [];
          const spaces = (await getIndoorList('spaces', { level_id: levelId })) as ApiSpace[];
          for (const row of spaces) {
            const obj = apiSpaceToObject(row);
            if (obj) objects.push(obj);
          }
          const openings = (await getIndoorList('openings', { level_id: levelId })) as ApiOpening[];
          for (const row of openings) {
            const obj = apiOpeningToObject(row);
            if (obj) objects.push(obj);
          }
          const connectors = (await getIndoorList('vertical_connectors', {
            building_id: building.id,
          })) as ApiVerticalConnector[];
          for (const row of connectors) {
            if (row.level_id !== levelId) continue;
            const obj = apiConnectorToObject(row);
            if (obj) objects.push(obj);
          }
          const amenities = (await getIndoorList('amenities', { level_id: levelId })) as ApiAmenity[];
          for (const row of amenities) {
            const obj = apiAmenityToObject(row);
            if (obj) objects.push(obj);
          }
          setFloorObjects(i, objects);
        }
        return true;
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Failed to load building';
        showToast(msg);
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [enterBuilding, setFloorObjects, showToast]
  );

  /**
   * Save current building and all floors' objects to DB.
   */
  const saveBuilding = useCallback(async () => {
    if (!buildingId || !venueId || !organizationId || !buildingFootprint) {
      showToast('No building to save');
      return;
    }
    setIsSaving(true);
    try {
      await patchIndoor('buildings', buildingId, {
        footprint_geom: polygonToMultiPolygonWkt(buildingFootprint),
      });
      for (let i = 0; i < floors.length; i++) {
        const floor = floors[i];
        const levelId = floor.levelId;
        if (!levelId) continue;
        for (const obj of floor.objects) {
          const table = obj.props.__dbTable ?? getDbTableForObjectType(obj.type);
          const payload: Record<string, unknown> = {
            level_id: levelId,
            building_id: buildingId,
            venue_id: venueId,
            name: obj.props.name ?? null,
            geom: geometryToWkt(obj.geometry),
          };
          if (table === 'spaces') {
            (payload as Record<string, unknown>).space_type = objectTypeToSpaceType(obj.type);
          } else if (table === 'openings') {
            (payload as Record<string, unknown>).opening_type = objectTypeToOpeningType(obj.type);
          } else if (table === 'vertical_connectors') {
            (payload as Record<string, unknown>).connector_type =
              objectTypeToConnectorType(obj.type);
            (payload as Record<string, unknown>).connector_group_id = buildingId;
          } else {
            (payload as Record<string, unknown>).amenity_type =
              objectTypeToAmenityType(obj.type);
          }
          if (obj.props.__dbId) {
            await patchIndoor(table, obj.props.__dbId, payload);
          } else {
            const created = (await postIndoor(table, payload)) as { id: string };
            updateObject(obj.id, {
              props: { __dbId: created.id, __dbTable: table },
            }, { skipUndo: true });
          }
        }
      }
      showToast('Saved successfully');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to save';
      showToast(msg);
    } finally {
      setIsSaving(false);
    }
  }, [
    buildingId,
    venueId,
    organizationId,
    buildingFootprint,
    floors,
    showToast,
  ]);

  return {
    enterBuildingWithDb,
    loadBuildingById,
    saveBuilding,
    isSaving,
    isLoading,
    hasIndoorContext: !!venueId && !!organizationId,
  };
}
