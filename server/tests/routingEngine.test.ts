import { describe, it, expect } from 'vitest';
import {
  computeTruckRoute,
  NoLegalRouteError,
  parseTimeToHours,
  formatHoursToTime,
  isHourInTimeBanWindow,
} from '../src/engine/routingEngine.js';
import {
  CORRIDOR_NODES,
  CORRIDOR_EDGES,
  DEMO_VEHICLES,
  INITIAL_DRIVER_REPORTS,
} from '../src/data/corridorGraph.js';
import { VehicleProfile, DriverReport } from '../src/types/truck.js';

describe('Routing Engine Unit Tests', () => {
  const graph = {
    nodes: CORRIDOR_NODES,
    edges: CORRIDOR_EDGES,
  };

  const containerTruck = DEMO_VEHICLES.find((v) => v.id === 'veh_container_40ft')!;

  describe('Time and Ban Helper Functions', () => {
    it('parses HH:mm to decimal hours correctly', () => {
      expect(parseTimeToHours('08:30')).toBe(8.5);
      expect(parseTimeToHours('14:45')).toBe(14.75);
      expect(parseTimeToHours('00:00')).toBe(0);
    });

    it('formats decimal hours to HH:mm string', () => {
      expect(formatHoursToTime(8.5)).toBe('08:30');
      expect(formatHoursToTime(14.75)).toBe('14:45');
      expect(formatHoursToTime(0)).toBe('00:00');
    });

    it('handles time ban windows correctly including midnight wraps', () => {
      // 07:00 to 11:00
      expect(isHourInTimeBanWindow(8.5, 7, 11)).toBe(true);
      expect(isHourInTimeBanWindow(12, 7, 11)).toBe(false);

      // 22:00 to 06:00 (wraps midnight)
      expect(isHourInTimeBanWindow(23, 22, 6)).toBe(true);
      expect(isHourInTimeBanWindow(4, 22, 6)).toBe(true);
      expect(isHourInTimeBanWindow(10, 22, 6)).toBe(false);
    });
  });

  describe('Scenario 1: Default 35t Container Truck (JNPT to Chakan MIDC)', () => {
    it('rejects the shortest direct route due to bridge/height limit and recommends compliant expressway route', () => {
      const plan = computeTruckRoute(
        graph,
        'jnpt_gate',
        'chakan_midc',
        containerTruck,
        '08:30',
        '18:00',
        INITIAL_DRIVER_REPORTS
      );

      expect(plan).toBeDefined();
      expect(plan.origin.id).toBe('jnpt_gate');
      expect(plan.destination.id).toBe('chakan_midc');
      expect(plan.routes.length).toBeGreaterThan(0);

      // 1. Recommended route exists
      const recommended = plan.routes.find((r) => r.id === plan.recommendedRouteId);
      expect(recommended).toBeDefined();
      expect(recommended!.timeMin).toBeGreaterThan(0);
      expect(recommended!.distanceKm).toBeGreaterThan(0);

      // 2. Unconstrained shortest route is rejected with clear plain-language reason
      expect(plan.rejectedRoutes.length).toBeGreaterThan(0);
      const unconstrainedRejected = plan.rejectedRoutes.find(
        (r) => r.id === 'rej_unconstrained_shortest'
      );
      expect(unconstrainedRejected).toBeDefined();
      expect(unconstrainedRejected!.blockedReason).toContain('Bridge limit');
      expect(unconstrainedRejected!.violationType).toBe('weight');

      // 3. Time-banned alternative through Lonavala town is captured in rejected routes
      const timeBanRejected = plan.rejectedRoutes.find(
        (r) => r.violationType === 'time_ban'
      );
      expect(timeBanRejected).toBeDefined();

      // 4. Plain-language whyThisRoute explanation mentions rejection and detour
      expect(plan.whyThisRoute).toContain('The shortest route was skipped');
      expect(plan.whyThisRoute).toContain('35 t');
      expect(plan.deadlineMissed).toBe(false);
    });
  });

  describe('Scenario 2: Active Blocking Driver Hazard Forces Reroute', () => {
    it('avoids road edge when an active blocking report is present', () => {
      // Normal plan without blocking report on the main expressway
      const normalPlan = computeTruckRoute(
        graph,
        'jnpt_gate',
        'chakan_midc',
        containerTruck,
        '08:30',
        '18:00',
        []
      );

      const normalEdges = normalPlan.routes[0].edgeIds;

      // Add blocking report on Khalapur-Bhor expressway viaduct
      const blockingReports: DriverReport[] = [
        {
          id: 'rep_test_blocking_viaduct',
          type: 'landslide',
          title: 'Massive rockslide across all expressway viaduct lanes',
          locationName: 'Bhor Ghat Modern Viaduct',
          lat: 18.845,
          lng: 73.288,
          active: true,
          severity: 'blocking',
          affectedEdgeId: 'e_khalapur_bhor_exp',
          createdAt: new Date().toISOString(),
          reportedBy: 'Highway Patrol',
        },
      ];

      // Since 'e_khalapur_bhor_exp' is the primary heavy freight expressway lane,
      // and the old road has a 20t bridge limit, a 35t container cannot pass either.
      // It should throw NoLegalRouteError because no legal path exists!
      expect(() =>
        computeTruckRoute(
          graph,
          'jnpt_gate',
          'chakan_midc',
          containerTruck,
          '08:30',
          '18:00',
          blockingReports
        )
      ).toThrow(NoLegalRouteError);
    });
  });

  describe('Scenario 3: Light Truck Permitted on Shortest Road', () => {
    it('allows a light truck to use roads that were forbidden to heavy trucks', () => {
      const lightTruck: VehicleProfile = {
        id: 'veh_light_delivery',
        name: 'Tata 407 Light Freight',
        type: 'tipper',
        loadedWeightT: 5.0,
        heightM: 2.8,
        widthM: 2.1,
        lengthM: 6.0,
        axles: 2,
        defaultCargo: 'general',
      };

      // Planning at 14:00 (outside morning time ban 07:00-11:00) with no reports
      const plan = computeTruckRoute(
        graph,
        'khopoli_old',
        'khandala_top',
        lightTruck,
        '14:00',
        '18:00',
        []
      );

      expect(plan).toBeDefined();
      expect(plan.routes.length).toBeGreaterThan(0);
      // Light truck can use the old ghat road directly!
      const topRoute = plan.routes[0];
      expect(topRoute.edgeIds).toContain('e_khopoli_amrutanjan_old');
    });
  });

  describe('Scenario 4: Delivery Deadline Checking', () => {
    it('flags deadlineMissed when departure plus transit exceeds deadline', () => {
      const plan = computeTruckRoute(
        graph,
        'jnpt_gate',
        'chakan_midc',
        containerTruck,
        '17:00',
        '18:00', // Only 1 hr given, but trip takes ~110 min
        INITIAL_DRIVER_REPORTS
      );

      expect(plan.deadlineMissed).toBe(true);
      expect(plan.whyThisRoute).toContain('misses the requested delivery deadline');
    });
  });

  describe('Scenario 5: No Legal Route Exception Handling', () => {
    it('throws NoLegalRouteError when impossible vehicle specifications are tested', () => {
      const extremeOverweightTruck: VehicleProfile = {
        id: 'veh_impossible',
        name: 'Monster 120 Ton Rig',
        type: 'flatbed',
        loadedWeightT: 120.0,
        heightM: 6.5,
        widthM: 4.5,
        lengthM: 40.0,
        axles: 14,
        defaultCargo: 'general',
      };

      expect(() =>
        computeTruckRoute(
          graph,
          'jnpt_gate',
          'chakan_midc',
          extremeOverweightTruck,
          '08:30',
          '18:00',
          []
        )
      ).toThrow(NoLegalRouteError);
    });
  });
});
