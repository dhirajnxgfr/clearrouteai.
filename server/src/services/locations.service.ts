import { RoadNode } from '../types/truck.js';
import { prisma, isDbConnected } from '../lib/prisma.js';
import { inMemoryStore } from './store.js';

export async function getLocations(query?: string): Promise<RoadNode[]> {
  let nodes: RoadNode[] = [];

  if (isDbConnected()) {
    try {
      const dbNodes = await prisma.roadNode.findMany({
        where: query
          ? {
              OR: [
                { name: { contains: query, mode: 'insensitive' } },
                { district: { contains: query, mode: 'insensitive' } },
                { id: { contains: query, mode: 'insensitive' } },
              ],
            }
          : undefined,
        orderBy: { name: 'asc' },
      });

      if (dbNodes.length > 0) {
        return dbNodes.map((n) => ({
          id: n.id,
          name: n.name,
          district: n.district,
          lat: n.lat,
          lng: n.lng,
          isDemoLocation: n.isDemoLocation,
        }));
      }
    } catch {
      // Fallback on error
    }
  }

  // Fallback to in-memory store
  nodes = Array.from(inMemoryStore.nodes.values());

  if (query) {
    const q = query.toLowerCase().trim();
    nodes = nodes.filter(
      (n) =>
        n.name.toLowerCase().includes(q) ||
        n.district.toLowerCase().includes(q) ||
        n.id.toLowerCase().includes(q)
    );
  }

  return nodes.sort((a, b) => a.name.localeCompare(b.name));
}

export async function getLocationById(id: string): Promise<RoadNode | null> {
  if (isDbConnected()) {
    try {
      const node = await prisma.roadNode.findUnique({ where: { id } });
      if (node) {
        return {
          id: node.id,
          name: node.name,
          district: node.district,
          lat: node.lat,
          lng: node.lng,
          isDemoLocation: node.isDemoLocation,
        };
      }
    } catch {
      // Fallback
    }
  }

  return inMemoryStore.nodes.get(id) || null;
}
