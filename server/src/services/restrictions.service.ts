import { Restriction, RestrictionType } from '../types/truck.js';
import { prisma, isDbConnected } from '../lib/prisma.js';
import { inMemoryStore } from './store.js';

export interface RestrictionFilter {
  type?: RestrictionType;
  minValue?: number;
  maxValue?: number;
  bbox?: string; // e.g. "minLat,minLng,maxLat,maxLng" or "minLng,minLat,maxLng,maxLat"
}

export async function getRestrictions(filter?: RestrictionFilter): Promise<Restriction[]> {
  let list: Restriction[] = [];

  if (isDbConnected()) {
    try {
      const dbRes = await prisma.restriction.findMany({
        where: {
          ...(filter?.type ? { type: filter.type } : {}),
          ...(filter?.minValue !== undefined ? { value: { gte: filter.minValue } } : {}),
          ...(filter?.maxValue !== undefined ? { value: { lte: filter.maxValue } } : {}),
        },
      });

      if (dbRes.length > 0) {
        list = dbRes.map((r) => ({
          id: r.id,
          edgeId: r.edgeId,
          type: r.type as RestrictionType,
          value: r.value,
          label: r.label,
          locationName: r.locationName,
          lat: r.lat,
          lng: r.lng,
          startHour: r.startHour || undefined,
          endHour: r.endHour || undefined,
          description: r.description,
          sourceAuthority: r.sourceAuthority || undefined,
        }));
      }
    } catch {
      // Fallback
    }
  }

  if (list.length === 0) {
    list = Array.from(inMemoryStore.restrictions.values());
  }

  // Apply in-memory filters
  if (filter?.type) {
    list = list.filter((r) => r.type === filter.type);
  }
  if (filter?.minValue !== undefined) {
    list = list.filter((r) => r.value >= filter.minValue!);
  }
  if (filter?.maxValue !== undefined) {
    list = list.filter((r) => r.value <= filter.maxValue!);
  }
  if (filter?.bbox) {
    const parts = filter.bbox.split(',').map((p) => parseFloat(p.trim()));
    if (parts.length === 4 && parts.every((n) => !isNaN(n))) {
      // Handle both [minLat, minLng, maxLat, maxLng] and [minLng, minLat, maxLng, maxLat]
      let minLat = Math.min(parts[0], parts[2]);
      let maxLat = Math.max(parts[0], parts[2]);
      let minLng = Math.min(parts[1], parts[3]);
      let maxLng = Math.max(parts[1], parts[3]);

      if (minLat > 40 || maxLat > 40) {
        // likely passed [minLng, minLat, maxLng, maxLat]
        minLng = Math.min(parts[0], parts[2]);
        maxLng = Math.max(parts[0], parts[2]);
        minLat = Math.min(parts[1], parts[3]);
        maxLat = Math.max(parts[1], parts[3]);
      }

      list = list.filter(
        (r) => r.lat >= minLat && r.lat <= maxLat && r.lng >= minLng && r.lng <= maxLng
      );
    }
  }

  return list;
}
