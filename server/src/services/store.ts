import {
  VehicleProfile,
  RoadNode,
  RoadEdge,
  Restriction,
  DriverReport,
  RoutingPlan,
  TripHistoryItem,
} from '../types/truck.js';
import {
  CORRIDOR_NODES,
  CORRIDOR_EDGES,
  DEMO_RESTRICTIONS,
  DEMO_VEHICLES,
  INITIAL_DRIVER_REPORTS,
} from '../data/corridorGraph.js';

// Fallback in-memory state initialized with real corridor graph data
class InMemoryStore {
  public nodes: Map<string, RoadNode> = new Map();
  public edges: Map<string, RoadEdge> = new Map();
  public restrictions: Map<string, Restriction> = new Map();
  public vehicles: Map<string, VehicleProfile> = new Map();
  public reports: Map<string, DriverReport> = new Map();
  public plans: Map<string, RoutingPlan> = new Map();
  public trips: Map<string, TripHistoryItem> = new Map();

  constructor() {
    this.reset();
  }

  public reset(): void {
    this.nodes.clear();
    this.edges.clear();
    this.restrictions.clear();
    this.vehicles.clear();
    this.reports.clear();
    this.plans.clear();
    this.trips.clear();

    // Populate nodes
    for (const [id, node] of Object.entries(CORRIDOR_NODES)) {
      this.nodes.set(id, { ...node });
    }

    // Populate restrictions
    for (const res of DEMO_RESTRICTIONS) {
      this.restrictions.set(res.id, { ...res });
    }

    // Populate edges
    for (const edge of CORRIDOR_EDGES) {
      this.edges.set(edge.id, { ...edge, restrictions: [...edge.restrictions] });
    }

    // Populate demo vehicles
    for (const veh of DEMO_VEHICLES) {
      this.vehicles.set(veh.id, { ...veh, isDemo: true, userId: null });
    }

    // Populate initial driver reports
    for (const rep of INITIAL_DRIVER_REPORTS) {
      this.reports.set(rep.id, { ...rep });
    }

    // Initial past trips
    const seedTrips: TripHistoryItem[] = [
      {
        id: 'trip_demo_1',
        date: 'Today, 08:30 AM',
        originName: 'JNPT Port Container Terminal 4',
        destinationName: 'Chakan MIDC Phase 2 (Auto Cluster)',
        vehicleName: 'BharatBenz 4028T Container (40ft High-Cube)',
        vehicleType: 'container',
        distanceKm: 104.8,
        durationMin: 112,
        status: 'active',
        costInr: 2940,
        startedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      },
      {
        id: 'trip_hist_2',
        date: 'Yesterday, 14:15 PM',
        originName: 'Uran CFS Logistics Park',
        destinationName: 'Talegaon Industrial Estate',
        vehicleName: 'Tata Signa 2823.K Petroleum Tanker',
        vehicleType: 'tanker',
        distanceKm: 86.4,
        durationMin: 95,
        status: 'completed',
        costInr: 2150,
        completedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'trip_hist_3',
        date: '06 Oct 2026, 21:00 PM',
        originName: 'Kalamboli / Panvel Freight Hub',
        destinationName: 'Bhosari MIDC Logistics Gate',
        vehicleName: 'Mahindra Blazo X 49 Multi-Axle Flatbed Trailer',
        vehicleType: 'flatbed',
        distanceKm: 98.6,
        durationMin: 108,
        status: 'completed',
        costInr: 3200,
        completedAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
      },
    ];

    for (const trip of seedTrips) {
      this.trips.set(trip.id, trip);
    }
  }
}

export const inMemoryStore = new InMemoryStore();
