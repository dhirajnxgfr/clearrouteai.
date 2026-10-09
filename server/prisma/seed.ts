import { PrismaClient } from '@prisma/client';
import {
  CORRIDOR_NODES,
  CORRIDOR_EDGES,
  DEMO_RESTRICTIONS,
  DEMO_VEHICLES,
  INITIAL_DRIVER_REPORTS,
} from '../src/data/corridorGraph.js';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding ClearRoute AI database with Mumbai-Pune Corridor data...');

  // 1. Seed Road Nodes
  console.log('-> Seeding Road Nodes...');
  for (const node of Object.values(CORRIDOR_NODES)) {
    await prisma.roadNode.upsert({
      where: { id: node.id },
      update: {
        name: node.name,
        district: node.district,
        lat: node.lat,
        lng: node.lng,
        isDemoLocation: node.isDemoLocation ?? true,
      },
      create: {
        id: node.id,
        name: node.name,
        district: node.district,
        lat: node.lat,
        lng: node.lng,
        isDemoLocation: node.isDemoLocation ?? true,
      },
    });
  }

  // 2. Seed Road Edges
  console.log('-> Seeding Road Edges...');
  for (const edge of CORRIDOR_EDGES) {
    await prisma.roadEdge.upsert({
      where: { id: edge.id },
      update: {
        fromNodeId: edge.from,
        toNodeId: edge.to,
        distanceKm: edge.distanceKm,
        baseTimeMin: edge.baseTimeMin,
        tollInr: edge.tollInr,
        roadName: edge.roadName,
        ghatSection: edge.ghatSection ?? false,
        laneCount: edge.laneCount ?? 4,
        pathCoordinates: edge.pathCoordinates as any,
      },
      create: {
        id: edge.id,
        fromNodeId: edge.from,
        toNodeId: edge.to,
        distanceKm: edge.distanceKm,
        baseTimeMin: edge.baseTimeMin,
        tollInr: edge.tollInr,
        roadName: edge.roadName,
        ghatSection: edge.ghatSection ?? false,
        laneCount: edge.laneCount ?? 4,
        pathCoordinates: edge.pathCoordinates as any,
      },
    });
  }

  // 3. Seed Restrictions
  console.log('-> Seeding Highway Restrictions...');
  for (const res of DEMO_RESTRICTIONS) {
    if (!res.edgeId) continue;
    await prisma.restriction.upsert({
      where: { id: res.id },
      update: {
        edgeId: res.edgeId,
        type: res.type as any,
        value: res.value,
        label: res.label,
        locationName: res.locationName,
        lat: res.lat,
        lng: res.lng,
        startHour: res.startHour ?? null,
        endHour: res.endHour ?? null,
        description: res.description,
        sourceAuthority: res.sourceAuthority ?? null,
      },
      create: {
        id: res.id,
        edgeId: res.edgeId,
        type: res.type as any,
        value: res.value,
        label: res.label,
        locationName: res.locationName,
        lat: res.lat,
        lng: res.lng,
        startHour: res.startHour ?? null,
        endHour: res.endHour ?? null,
        description: res.description,
        sourceAuthority: res.sourceAuthority ?? null,
      },
    });
  }

  // 4. Seed Demo Vehicles
  console.log('-> Seeding Demo Truck Profiles...');
  for (const veh of DEMO_VEHICLES) {
    await prisma.vehicle.upsert({
      where: { id: veh.id },
      update: {
        name: veh.name,
        type: veh.type as any,
        loadedWeightT: veh.loadedWeightT,
        heightM: veh.heightM,
        widthM: veh.widthM,
        lengthM: veh.lengthM,
        axles: veh.axles,
        defaultCargo: veh.defaultCargo as any,
        registrationNumber: veh.registrationNumber ?? null,
        isDemo: true,
        userId: null,
      },
      create: {
        id: veh.id,
        name: veh.name,
        type: veh.type as any,
        loadedWeightT: veh.loadedWeightT,
        heightM: veh.heightM,
        widthM: veh.widthM,
        lengthM: veh.lengthM,
        axles: veh.axles,
        defaultCargo: veh.defaultCargo as any,
        registrationNumber: veh.registrationNumber ?? null,
        isDemo: true,
        userId: null,
      },
    });
  }

  // 5. Seed Initial Driver Reports
  console.log('-> Seeding Initial Driver Hazard Reports...');
  for (const rep of INITIAL_DRIVER_REPORTS) {
    await prisma.driverReport.upsert({
      where: { id: rep.id },
      update: {
        type: rep.type as any,
        title: rep.title,
        locationName: rep.locationName,
        lat: rep.lat,
        lng: rep.lng,
        active: rep.active,
        severity: rep.severity as any,
        affectedEdgeId: rep.affectedEdgeId ?? null,
        notes: rep.notes ?? null,
        reportedBy: rep.reportedBy,
      },
      create: {
        id: rep.id,
        type: rep.type as any,
        title: rep.title,
        locationName: rep.locationName,
        lat: rep.lat,
        lng: rep.lng,
        active: rep.active,
        severity: rep.severity as any,
        affectedEdgeId: rep.affectedEdgeId ?? null,
        notes: rep.notes ?? null,
        reportedBy: rep.reportedBy,
      },
    });
  }

  console.log('✅ Corridor database seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
