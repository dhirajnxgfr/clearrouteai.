import { DriverReport, HazardType } from '../types/truck.js';
import { prisma, isDbConnected } from '../lib/prisma.js';
import { inMemoryStore } from './store.js';
import { AppError } from '../middleware/errorHandler.js';

export interface CreateReportInput {
  type: HazardType;
  title: string;
  locationName: string;
  lat: number;
  lng: number;
  severity: 'blocking' | 'caution';
  affectedEdgeId?: string;
  notes?: string;
  reportedBy?: string;
}

export async function getReports(activeOnly?: boolean): Promise<DriverReport[]> {
  if (isDbConnected()) {
    try {
      const records = await prisma.driverReport.findMany({
        where: activeOnly !== undefined ? { active: activeOnly } : undefined,
        orderBy: { createdAt: 'desc' },
      });

      if (records.length > 0) {
        return records.map((r) => ({
          id: r.id,
          userId: r.userId,
          type: r.type as HazardType,
          title: r.title,
          locationName: r.locationName,
          lat: r.lat,
          lng: r.lng,
          active: r.active,
          severity: r.severity as 'blocking' | 'caution',
          createdAt: r.createdAt.toISOString(),
          reportedBy: r.reportedBy,
          affectedEdgeId: r.affectedEdgeId || undefined,
          notes: r.notes || undefined,
        }));
      }
    } catch {
      // Fallback
    }
  }

  let list = Array.from(inMemoryStore.reports.values());
  if (activeOnly !== undefined) {
    list = list.filter((r) => r.active === activeOnly);
  }
  return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function createReport(
  data: CreateReportInput,
  userId: string | null,
  userEmail?: string
): Promise<DriverReport> {
  const reportedBy =
    data.reportedBy?.trim() ||
    (userEmail ? `Driver (${userEmail})` : 'Community Patrol Driver');

  if (isDbConnected()) {
    try {
      const created = await prisma.driverReport.create({
        data: {
          userId,
          type: data.type,
          title: data.title,
          locationName: data.locationName,
          lat: data.lat,
          lng: data.lng,
          active: true,
          severity: data.severity,
          affectedEdgeId: data.affectedEdgeId || null,
          notes: data.notes || null,
          reportedBy,
        },
      });

      return {
        id: created.id,
        userId: created.userId,
        type: created.type as HazardType,
        title: created.title,
        locationName: created.locationName,
        lat: created.lat,
        lng: created.lng,
        active: created.active,
        severity: created.severity as 'blocking' | 'caution',
        createdAt: created.createdAt.toISOString(),
        reportedBy: created.reportedBy,
        affectedEdgeId: created.affectedEdgeId || undefined,
        notes: created.notes || undefined,
      };
    } catch {
      // Fallback
    }
  }

  const id = `rep_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const newReport: DriverReport = {
    ...data,
    id,
    userId,
    active: true,
    reportedBy,
    createdAt: new Date().toISOString(),
  };

  inMemoryStore.reports.set(id, newReport);
  return newReport;
}

export async function toggleReportActive(id: string): Promise<DriverReport> {
  if (isDbConnected()) {
    try {
      const existing = await prisma.driverReport.findUnique({ where: { id } });
      if (!existing) {
        throw new AppError('Driver report not found', 404, 'NOT_FOUND');
      }

      const updated = await prisma.driverReport.update({
        where: { id },
        data: { active: !existing.active },
      });

      return {
        id: updated.id,
        userId: updated.userId,
        type: updated.type as HazardType,
        title: updated.title,
        locationName: updated.locationName,
        lat: updated.lat,
        lng: updated.lng,
        active: updated.active,
        severity: updated.severity as 'blocking' | 'caution',
        createdAt: updated.createdAt.toISOString(),
        reportedBy: updated.reportedBy,
        affectedEdgeId: updated.affectedEdgeId || undefined,
        notes: updated.notes || undefined,
      };
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      // Fallback
    }
  }

  const existing = inMemoryStore.reports.get(id);
  if (!existing) {
    throw new AppError('Driver report not found', 404, 'NOT_FOUND');
  }

  const updated: DriverReport = {
    ...existing,
    active: !existing.active,
  };
  inMemoryStore.reports.set(id, updated);
  return updated;
}
