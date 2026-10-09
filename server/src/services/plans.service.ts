import {
  RoutingPlan,
  VehicleProfile,
  CorridorGraph,
  RoadNode,
  RoadEdge,
  Restriction,
  TripHistoryItem,
} from '../types/truck.js';
import { prisma, isDbConnected } from '../lib/prisma.js';
import { inMemoryStore } from './store.js';
import { computeTruckRoute, formatHoursToTime, parseTimeToHours } from '../engine/routingEngine.js';
import { getVehicleById } from './vehicles.service.js';
import { getReports } from './reports.service.js';
import { AppError } from '../middleware/errorHandler.js';

export interface CreatePlanParams {
  originId: string;
  destinationId: string;
  vehicleId?: string;
  vehicle?: VehicleProfile;
  departureTime?: string;
  deadlineTime?: string;
}

export async function loadCorridorGraph(): Promise<CorridorGraph> {
  if (isDbConnected()) {
    try {
      const dbNodes = await prisma.roadNode.findMany();
      const dbEdges = await prisma.roadEdge.findMany({
        include: { restrictions: true },
      });

      if (dbNodes.length > 0 && dbEdges.length > 0) {
        const nodesMap: Record<string, RoadNode> = {};
        for (const n of dbNodes) {
          nodesMap[n.id] = {
            id: n.id,
            name: n.name,
            district: n.district,
            lat: n.lat,
            lng: n.lng,
            isDemoLocation: n.isDemoLocation,
          };
        }

        const edgesList: RoadEdge[] = dbEdges.map((e) => ({
          id: e.id,
          from: e.fromNodeId,
          to: e.toNodeId,
          distanceKm: e.distanceKm,
          baseTimeMin: e.baseTimeMin,
          tollInr: e.tollInr,
          roadName: e.roadName,
          ghatSection: e.ghatSection,
          laneCount: e.laneCount || undefined,
          pathCoordinates: (e.pathCoordinates as [number, number][]) || [],
          restrictions: e.restrictions.map((r) => ({
            id: r.id,
            edgeId: r.edgeId,
            type: r.type as any,
            value: r.value,
            label: r.label,
            locationName: r.locationName,
            lat: r.lat,
            lng: r.lng,
            startHour: r.startHour || undefined,
            endHour: r.endHour || undefined,
            description: r.description,
            sourceAuthority: r.sourceAuthority || undefined,
          })),
        }));

        return { nodes: nodesMap, edges: edgesList };
      }
    } catch {
      // Fallback
    }
  }

  // Fallback to in-memory store
  const nodesMap: Record<string, RoadNode> = {};
  for (const [id, n] of inMemoryStore.nodes.entries()) {
    nodesMap[id] = n;
  }
  const edgesList = Array.from(inMemoryStore.edges.values());

  return { nodes: nodesMap, edges: edgesList };
}

export async function createPlan(
  params: CreatePlanParams,
  userId: string | null,
  guestId: string | null
): Promise<RoutingPlan> {
  const actor = userId || guestId || null;

  // 1. Resolve Vehicle
  let targetVehicle: VehicleProfile | null = null;
  if (params.vehicle) {
    targetVehicle = params.vehicle;
  } else if (params.vehicleId) {
    targetVehicle = await getVehicleById(params.vehicleId);
  }

  if (!targetVehicle) {
    throw new AppError('A valid vehicleId or vehicle profile must be provided', 400, 'INVALID_VEHICLE');
  }

  const departureTime = params.departureTime || '08:30';
  const deadlineTime = params.deadlineTime || '18:00';

  // 2. Fetch Graph & Active Driver Reports
  const graph = await loadCorridorGraph();
  const activeReports = await getReports(true);

  // 3. Run Routing Engine (Pure function)
  const plan = computeTruckRoute(
    graph,
    params.originId,
    params.destinationId,
    targetVehicle,
    departureTime,
    deadlineTime,
    activeReports
  );
  plan.userId = actor;

  const topRoute = plan.routes[0];
  const distanceKm = topRoute ? topRoute.distanceKm : 105;
  const durationMin = topRoute ? topRoute.timeMin : 110;
  const costInr = topRoute ? topRoute.totalCostInr : 2850;

  // 4. Persist in Database (using transaction when DB is connected)
  if (isDbConnected()) {
    try {
      await prisma.$transaction([
        prisma.routingPlan.create({
          data: {
            id: plan.id,
            userId: actor,
            originNodeId: plan.origin.id,
            destinationNodeId: plan.destination.id,
            vehicleSnapshot: plan.vehicle as any,
            departureTime: plan.departureTime,
            deadlineTime: plan.deadlineTime,
            result: plan as any,
          },
        }),
        prisma.trip.create({
          data: {
            id: `trip_${plan.id}`,
            userId: actor,
            planId: plan.id,
            status: 'planned',
            distanceKm,
            durationMin,
            costInr,
          },
        }),
      ]);
    } catch (err) {
      console.warn('Prisma transaction failed, saving to in-memory store:', err);
    }
  }

  // Always store in inMemoryStore
  inMemoryStore.plans.set(plan.id, plan);

  const tripItem: TripHistoryItem = {
    id: `trip_${plan.id}`,
    userId: actor,
    planId: plan.id,
    date: new Date().toLocaleDateString('en-IN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }),
    originName: plan.origin.name,
    destinationName: plan.destination.name,
    vehicleName: plan.vehicle.name,
    vehicleType: plan.vehicle.type,
    distanceKm,
    durationMin,
    status: 'planned',
    costInr,
    createdAt: new Date().toISOString(),
  };
  inMemoryStore.trips.set(tripItem.id, tripItem);

  return plan;
}

export async function getPlanById(id: string): Promise<RoutingPlan | null> {
  if (isDbConnected()) {
    try {
      const record = await prisma.routingPlan.findUnique({ where: { id } });
      if (record && record.result) {
        return record.result as unknown as RoutingPlan;
      }
    } catch {
      // Fallback
    }
  }

  // Demo fallback: default or demo plans
  if (id === 'demo_default' || id.startsWith('trip_demo')) {
    const graph = await loadCorridorGraph();
    const defaultVehicle = inMemoryStore.vehicles.get('veh_container_40ft')!;
    const activeReports = await getReports(true);
    const demoPlan = computeTruckRoute(
      graph,
      'jnpt_gate',
      'chakan_midc',
      defaultVehicle,
      '08:30',
      '18:00',
      activeReports
    );
    demoPlan.id = id;
    inMemoryStore.plans.set(id, demoPlan);
    return demoPlan;
  }

  return inMemoryStore.plans.get(id) || null;
}

export async function reroutePlan(
  id: string
): Promise<{ plan: RoutingPlan; changes: string }> {
  const existingPlan = await getPlanById(id);
  if (!existingPlan) {
    throw new AppError('Routing plan not found', 404, 'NOT_FOUND');
  }

  const graph = await loadCorridorGraph();
  const activeReports = await getReports(true);

  const newPlan = computeTruckRoute(
    graph,
    existingPlan.origin.id,
    existingPlan.destination.id,
    existingPlan.vehicle,
    existingPlan.departureTime,
    existingPlan.deadlineTime,
    activeReports
  );

  const oldRoute = existingPlan.routes[0];
  const newRoute = newPlan.routes[0];

  let changes = '';
  if (!oldRoute || !newRoute) {
    changes = 'Plan re-evaluated against current road conditions.';
  } else {
    const timeDiff = newRoute.timeMin - oldRoute.timeMin;
    const distDiff = Math.round((newRoute.distanceKm - oldRoute.distanceKm) * 10) / 10;
    const edgeDiff = JSON.stringify(oldRoute.edgeIds) !== JSON.stringify(newRoute.edgeIds);

    if (edgeDiff) {
      if (timeDiff > 0) {
        changes = `Rerouted due to active road hazards: adds ${timeDiff} min (+${distDiff} km). Verified permitted corridor.`;
      } else {
        changes = `Rerouted onto optimized clearance corridor: saves ${Math.abs(timeDiff)} min.`;
      }
    } else {
      changes = `Route confirmed: current path via ${newRoute.title} remains clear with no active blocking hazards.`;
    }
  }

  // Update in DB / store
  newPlan.id = existingPlan.id;
  newPlan.userId = existingPlan.userId;

  if (isDbConnected()) {
    try {
      await prisma.routingPlan.update({
        where: { id },
        data: {
          result: newPlan as any,
        },
      });
    } catch {
      // Fallback
    }
  }

  inMemoryStore.plans.set(id, newPlan);

  return { plan: newPlan, changes };
}
