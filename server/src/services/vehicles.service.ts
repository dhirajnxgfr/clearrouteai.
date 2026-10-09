import { VehicleProfile, VehicleType, CargoType } from '../types/truck.js';
import { prisma, isDbConnected } from '../lib/prisma.js';
import { inMemoryStore } from './store.js';
import { AppError } from '../middleware/errorHandler.js';

export interface CreateVehicleInput {
  name: string;
  type: VehicleType;
  loadedWeightT: number;
  heightM: number;
  widthM: number;
  lengthM: number;
  axles: number;
  defaultCargo: CargoType;
  registrationNumber?: string;
}

export interface UpdateVehicleInput {
  name?: string;
  type?: VehicleType;
  loadedWeightT?: number;
  heightM?: number;
  widthM?: number;
  lengthM?: number;
  axles?: number;
  defaultCargo?: CargoType;
  registrationNumber?: string;
}

export async function getVehicles(userId: string | null, guestId: string | null): Promise<VehicleProfile[]> {
  const actor = userId || guestId;

  if (isDbConnected()) {
    try {
      const records = await prisma.vehicle.findMany({
        where: {
          OR: [
            { isDemo: true },
            { userId: null },
            ...(actor ? [{ userId: actor }] : []),
          ],
        },
        orderBy: [{ isDemo: 'desc' }, { createdAt: 'desc' }],
      });

      if (records.length > 0) {
        return records.map((v) => ({
          id: v.id,
          name: v.name,
          type: v.type as VehicleType,
          loadedWeightT: v.loadedWeightT,
          heightM: v.heightM,
          widthM: v.widthM,
          lengthM: v.lengthM,
          axles: v.axles,
          defaultCargo: v.defaultCargo as CargoType,
          registrationNumber: v.registrationNumber || undefined,
          userId: v.userId,
          isDemo: v.isDemo,
          createdAt: v.createdAt.toISOString(),
          updatedAt: v.updatedAt.toISOString(),
        }));
      }
    } catch {
      // Fallback
    }
  }

  // In-memory fallback
  const all = Array.from(inMemoryStore.vehicles.values());
  return all.filter((v) => v.isDemo || v.userId === null || (actor && v.userId === actor));
}

export async function getVehicleById(id: string): Promise<VehicleProfile | null> {
  if (isDbConnected()) {
    try {
      const v = await prisma.vehicle.findUnique({ where: { id } });
      if (v) {
        return {
          id: v.id,
          name: v.name,
          type: v.type as VehicleType,
          loadedWeightT: v.loadedWeightT,
          heightM: v.heightM,
          widthM: v.widthM,
          lengthM: v.lengthM,
          axles: v.axles,
          defaultCargo: v.defaultCargo as CargoType,
          registrationNumber: v.registrationNumber || undefined,
          userId: v.userId,
          isDemo: v.isDemo,
          createdAt: v.createdAt.toISOString(),
          updatedAt: v.updatedAt.toISOString(),
        };
      }
    } catch {
      // Fallback
    }
  }

  return inMemoryStore.vehicles.get(id) || null;
}

export async function createVehicle(
  data: CreateVehicleInput,
  userId: string | null,
  guestId: string | null
): Promise<VehicleProfile> {
  const ownerId = userId || guestId || null;

  if (isDbConnected()) {
    try {
      const created = await prisma.vehicle.create({
        data: {
          name: data.name,
          type: data.type,
          loadedWeightT: data.loadedWeightT,
          heightM: data.heightM,
          widthM: data.widthM,
          lengthM: data.lengthM,
          axles: data.axles,
          defaultCargo: data.defaultCargo,
          registrationNumber: data.registrationNumber || null,
          userId: ownerId,
          isDemo: false,
        },
      });

      return {
        id: created.id,
        name: created.name,
        type: created.type as VehicleType,
        loadedWeightT: created.loadedWeightT,
        heightM: created.heightM,
        widthM: created.widthM,
        lengthM: created.lengthM,
        axles: created.axles,
        defaultCargo: created.defaultCargo as CargoType,
        registrationNumber: created.registrationNumber || undefined,
        userId: created.userId,
        isDemo: created.isDemo,
        createdAt: created.createdAt.toISOString(),
        updatedAt: created.updatedAt.toISOString(),
      };
    } catch {
      // Fallback
    }
  }

  // In-memory fallback
  const id = `veh_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const newVeh: VehicleProfile = {
    ...data,
    id,
    userId: ownerId,
    isDemo: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  inMemoryStore.vehicles.set(id, newVeh);
  return newVeh;
}

export async function updateVehicle(
  id: string,
  data: UpdateVehicleInput,
  userId: string | null,
  guestId: string | null
): Promise<VehicleProfile> {
  const actor = userId || guestId;
  const existing = await getVehicleById(id);

  if (!existing) {
    throw new AppError('Vehicle not found', 404, 'NOT_FOUND');
  }

  if (existing.isDemo) {
    throw new AppError('Shared demo vehicles cannot be modified', 403, 'FORBIDDEN');
  }

  if (existing.userId && actor && existing.userId !== actor) {
    throw new AppError('You do not have permission to modify this vehicle', 403, 'FORBIDDEN');
  }

  if (isDbConnected()) {
    try {
      const updated = await prisma.vehicle.update({
        where: { id },
        data: {
          ...(data.name !== undefined && { name: data.name }),
          ...(data.type !== undefined && { type: data.type }),
          ...(data.loadedWeightT !== undefined && { loadedWeightT: data.loadedWeightT }),
          ...(data.heightM !== undefined && { heightM: data.heightM }),
          ...(data.widthM !== undefined && { widthM: data.widthM }),
          ...(data.lengthM !== undefined && { lengthM: data.lengthM }),
          ...(data.axles !== undefined && { axles: data.axles }),
          ...(data.defaultCargo !== undefined && { defaultCargo: data.defaultCargo }),
          ...(data.registrationNumber !== undefined && { registrationNumber: data.registrationNumber }),
        },
      });

      return {
        id: updated.id,
        name: updated.name,
        type: updated.type as VehicleType,
        loadedWeightT: updated.loadedWeightT,
        heightM: updated.heightM,
        widthM: updated.widthM,
        lengthM: updated.lengthM,
        axles: updated.axles,
        defaultCargo: updated.defaultCargo as CargoType,
        registrationNumber: updated.registrationNumber || undefined,
        userId: updated.userId,
        isDemo: updated.isDemo,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      };
    } catch {
      // Fallback
    }
  }

  // In-memory fallback
  const updatedVeh: VehicleProfile = {
    ...existing,
    ...data,
    updatedAt: new Date().toISOString(),
  };
  inMemoryStore.vehicles.set(id, updatedVeh);
  return updatedVeh;
}

export async function deleteVehicle(
  id: string,
  userId: string | null,
  guestId: string | null
): Promise<void> {
  const actor = userId || guestId;
  const existing = await getVehicleById(id);

  if (!existing) {
    throw new AppError('Vehicle not found', 404, 'NOT_FOUND');
  }

  if (existing.isDemo) {
    throw new AppError('Shared demo vehicles cannot be deleted', 403, 'FORBIDDEN');
  }

  if (existing.userId && actor && existing.userId !== actor) {
    throw new AppError('You do not have permission to delete this vehicle', 403, 'FORBIDDEN');
  }

  if (isDbConnected()) {
    try {
      await prisma.vehicle.delete({ where: { id } });
      return;
    } catch {
      // Fallback
    }
  }

  inMemoryStore.vehicles.delete(id);
}
