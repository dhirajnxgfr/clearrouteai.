import { TripHistoryItem } from '../types/truck.js';
import { prisma, isDbConnected } from '../lib/prisma.js';
import { inMemoryStore } from './store.js';
import { AppError } from '../middleware/errorHandler.js';

export async function getTrips(
  userId: string | null,
  guestId: string | null
): Promise<TripHistoryItem[]> {
  const actor = userId || guestId;

  if (isDbConnected()) {
    try {
      const records = await prisma.trip.findMany({
        where: {
          OR: [
            { userId: null },
            ...(actor ? [{ userId: actor }] : []),
          ],
        },
        include: {
          plan: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      if (records.length > 0) {
        return records.map((t) => {
          const planData = t.plan?.result as any;
          return {
            id: t.id,
            userId: t.userId,
            planId: t.planId,
            date: t.createdAt.toLocaleDateString('en-IN', {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            }),
            originName: planData?.origin?.name || 'JNPT Port Container Terminal 4',
            destinationName: planData?.destination?.name || 'Chakan MIDC Phase 2',
            vehicleName: planData?.vehicle?.name || 'Commercial Freight Carrier',
            vehicleType: planData?.vehicle?.type || 'container',
            distanceKm: t.distanceKm,
            durationMin: t.durationMin,
            status: t.status as 'planned' | 'active' | 'completed',
            costInr: t.costInr,
            startedAt: t.startedAt ? t.startedAt.toISOString() : null,
            completedAt: t.completedAt ? t.completedAt.toISOString() : null,
            createdAt: t.createdAt.toISOString(),
          };
        });
      }
    } catch {
      // Fallback
    }
  }

  // In-memory fallback
  const allTrips = Array.from(inMemoryStore.trips.values());
  return allTrips.filter((t) => !t.userId || t.userId === actor || t.id.startsWith('trip_demo') || t.id.startsWith('trip_hist'));
}

export async function updateTripStatus(
  id: string,
  status: 'planned' | 'active' | 'completed',
  userId: string | null,
  guestId: string | null
): Promise<TripHistoryItem> {
  const actor = userId || guestId;
  const now = new Date();

  if (isDbConnected()) {
    try {
      const existing = await prisma.trip.findUnique({
        where: { id },
        include: { plan: true },
      });

      if (!existing) {
        throw new AppError('Trip not found', 404, 'NOT_FOUND');
      }

      if (existing.userId && actor && existing.userId !== actor) {
        throw new AppError('You do not have permission to update this trip', 403, 'FORBIDDEN');
      }

      const updated = await prisma.trip.update({
        where: { id },
        data: {
          status,
          ...(status === 'active' && !existing.startedAt ? { startedAt: now } : {}),
          ...(status === 'completed' && !existing.completedAt ? { completedAt: now } : {}),
        },
        include: { plan: true },
      });

      const planData = updated.plan?.result as any;
      return {
        id: updated.id,
        userId: updated.userId,
        planId: updated.planId,
        date: updated.createdAt.toLocaleDateString('en-IN', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
        originName: planData?.origin?.name || 'JNPT Port Container Terminal 4',
        destinationName: planData?.destination?.name || 'Chakan MIDC Phase 2',
        vehicleName: planData?.vehicle?.name || 'Commercial Freight Carrier',
        vehicleType: planData?.vehicle?.type || 'container',
        distanceKm: updated.distanceKm,
        durationMin: updated.durationMin,
        status: updated.status as 'planned' | 'active' | 'completed',
        costInr: updated.costInr,
        startedAt: updated.startedAt?.toISOString() || null,
        completedAt: updated.completedAt?.toISOString() || null,
        createdAt: updated.createdAt.toISOString(),
      };
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      // Fallback
    }
  }

  // In-memory fallback
  const existing = inMemoryStore.trips.get(id);
  if (!existing) {
    throw new AppError('Trip not found', 404, 'NOT_FOUND');
  }

  if (existing.userId && actor && existing.userId !== actor) {
    throw new AppError('You do not have permission to update this trip', 403, 'FORBIDDEN');
  }

  const updatedItem: TripHistoryItem = {
    ...existing,
    status,
    ...(status === 'active' && !existing.startedAt ? { startedAt: now.toISOString() } : {}),
    ...(status === 'completed' && !existing.completedAt ? { completedAt: now.toISOString() } : {}),
  };

  inMemoryStore.trips.set(id, updatedItem);
  return updatedItem;
}
