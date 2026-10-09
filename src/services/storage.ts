import { VehicleProfile, DriverReport, RoutingPlan, TripHistoryItem } from '../types/truck';
import { DEMO_VEHICLES, INITIAL_DRIVER_REPORTS } from '../data/corridorGraph';
import { computeTruckRoute } from '../engine/routingEngine';

const API_BASE = '/api/v1';

const STORAGE_KEYS = {
  VEHICLES: 'truckroute_vehicles_v1',
  TRIPS: 'truckroute_trips_v1',
  PLANS: 'truckroute_saved_plans_v1',
  REPORTS: 'truckroute_driver_reports_v1',
  ACTIVE_VEHICLE_ID: 'truckroute_active_vehicle_id',
  GUEST_ID: 'clearroute_guest_id',
};

// Retrieve or initialize anonymous guest ID
export function getGuestId(): string {
  try {
    let id = localStorage.getItem(STORAGE_KEYS.GUEST_ID);
    if (!id) {
      id = 'guest_' + Math.random().toString(36).substring(2, 9);
      localStorage.setItem(STORAGE_KEYS.GUEST_ID, id);
    }
    return id;
  } catch {
    return 'guest_demo_user';
  }
}

// Common headers for backend requests
function getAuthHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-guest-id': getGuestId(),
  };

  try {
    const supabaseToken = localStorage.getItem('sb-access-token') || localStorage.getItem('supabase.auth.token');
    if (supabaseToken) {
      headers['Authorization'] = `Bearer ${supabaseToken}`;
    }
  } catch {}

  return headers;
}

// Background API sync helper
async function apiCall<T>(endpoint: string, options: RequestInit = {}): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        ...getAuthHeaders(),
        ...(options.headers as Record<string, string>),
      },
    });
    if (!res.ok) {
      return null;
    }
    return await res.json();
  } catch {
    return null;
  }
}

// --- Vehicles ---
export function getSavedVehicles(): VehicleProfile[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.VEHICLES);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Sync with backend in background
        apiCall<VehicleProfile[]>('/vehicles').then((serverVehicles) => {
          if (serverVehicles && Array.isArray(serverVehicles) && serverVehicles.length > 0) {
            localStorage.setItem(STORAGE_KEYS.VEHICLES, JSON.stringify(serverVehicles));
          }
        });
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Failed to parse vehicles from localStorage', err);
  }

  // Initialize with demo vehicles and sync to backend
  localStorage.setItem(STORAGE_KEYS.VEHICLES, JSON.stringify(DEMO_VEHICLES));
  apiCall<VehicleProfile[]>('/vehicles').then((serverVehicles) => {
    if (serverVehicles && Array.isArray(serverVehicles) && serverVehicles.length > 0) {
      localStorage.setItem(STORAGE_KEYS.VEHICLES, JSON.stringify(serverVehicles));
    }
  });
  return DEMO_VEHICLES;
}

export function saveVehicle(vehicle: VehicleProfile): VehicleProfile[] {
  const current = getSavedVehicles();
  const index = current.findIndex((v) => v.id === vehicle.id);
  let updated: VehicleProfile[];
  if (index >= 0) {
    updated = [...current];
    updated[index] = vehicle;
    apiCall(`/vehicles/${vehicle.id}`, {
      method: 'PUT',
      body: JSON.stringify(vehicle),
    });
  } else {
    updated = [...current, vehicle];
    apiCall('/vehicles', {
      method: 'POST',
      body: JSON.stringify(vehicle),
    });
  }
  localStorage.setItem(STORAGE_KEYS.VEHICLES, JSON.stringify(updated));
  return updated;
}

export function deleteVehicle(id: string): VehicleProfile[] {
  const current = getSavedVehicles();
  const updated = current.filter((v) => v.id !== id);
  localStorage.setItem(STORAGE_KEYS.VEHICLES, JSON.stringify(updated));
  apiCall(`/vehicles/${id}`, { method: 'DELETE' });
  return updated;
}

export function getActiveVehicleId(): string {
  return localStorage.getItem(STORAGE_KEYS.ACTIVE_VEHICLE_ID) || 'veh_container_40ft';
}

export function setActiveVehicleId(id: string): void {
  localStorage.setItem(STORAGE_KEYS.ACTIVE_VEHICLE_ID, id);
}

// --- Driver Reports ---
export function getSavedReports(): DriverReport[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.REPORTS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        apiCall<DriverReport[]>('/reports').then((serverReports) => {
          if (serverReports && Array.isArray(serverReports) && serverReports.length > 0) {
            localStorage.setItem(STORAGE_KEYS.REPORTS, JSON.stringify(serverReports));
          }
        });
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Failed to parse reports from localStorage', err);
  }

  localStorage.setItem(STORAGE_KEYS.REPORTS, JSON.stringify(INITIAL_DRIVER_REPORTS));
  apiCall<DriverReport[]>('/reports').then((serverReports) => {
    if (serverReports && Array.isArray(serverReports) && serverReports.length > 0) {
      localStorage.setItem(STORAGE_KEYS.REPORTS, JSON.stringify(serverReports));
    }
  });
  return INITIAL_DRIVER_REPORTS;
}

export function addDriverReport(report: Omit<DriverReport, 'id' | 'createdAt'>): DriverReport {
  const current = getSavedReports();
  const newReport: DriverReport = {
    ...report,
    id: `rep_${Date.now()}`,
    createdAt: 'Just now',
  };
  const updated = [newReport, ...current];
  localStorage.setItem(STORAGE_KEYS.REPORTS, JSON.stringify(updated));

  // Sync to backend POST /api/v1/reports
  apiCall('/reports', {
    method: 'POST',
    body: JSON.stringify(report),
  });

  return newReport;
}

export function toggleReportActive(reportId: string): DriverReport[] {
  const current = getSavedReports();
  const updated = current.map((r) => (r.id === reportId ? { ...r, active: !r.active } : r));
  localStorage.setItem(STORAGE_KEYS.REPORTS, JSON.stringify(updated));

  // Sync to backend PATCH /api/v1/reports/:id/active
  apiCall(`/reports/${reportId}/active`, { method: 'PATCH' });

  return updated;
}

// --- Plans & Trips ---
export function getSavedPlan(planId: string): RoutingPlan | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PLANS);
    if (raw) {
      const parsed: Record<string, RoutingPlan> = JSON.parse(raw);
      if (parsed[planId]) {
        // Also fetch updated plan from backend
        apiCall<RoutingPlan>(`/plans/${planId}`).then((backendPlan) => {
          if (backendPlan) {
            parsed[planId] = backendPlan;
            localStorage.setItem(STORAGE_KEYS.PLANS, JSON.stringify(parsed));
          }
        });
        return parsed[planId];
      }
    }
  } catch (err) {
    console.warn('Error fetching plan', err);
  }

  // If requesting standard demo plan, compute and save
  if (planId === 'demo_default' || planId.startsWith('trip_demo')) {
    const defaultVehicle = getSavedVehicles()[0];
    const demoPlan = computeTruckRoute(
      'jnpt_gate',
      'chakan_midc',
      defaultVehicle,
      '08:30',
      '18:00',
      getSavedReports()
    );
    demoPlan.id = planId;
    savePlan(demoPlan);
    return demoPlan;
  }

  return null;
}

export function savePlan(plan: RoutingPlan): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PLANS);
    const existing: Record<string, RoutingPlan> = raw ? JSON.parse(raw) : {};
    existing[plan.id] = plan;
    localStorage.setItem(STORAGE_KEYS.PLANS, JSON.stringify(existing));

    addTripHistoryItem({
      id: plan.id,
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
      distanceKm: plan.routes[0]?.distanceKm || 105,
      durationMin: plan.routes[0]?.timeMin || 110,
      status: 'planned',
      costInr: plan.routes[0]?.totalCostInr || 2850,
    });

    // Also persist plan & trip in backend database
    apiCall('/plans', {
      method: 'POST',
      body: JSON.stringify({
        originId: plan.origin.id,
        destinationId: plan.destination.id,
        vehicle: plan.vehicle,
        departureTime: plan.departureTime,
        deadlineTime: plan.deadlineTime,
      }),
    });
  } catch (err) {
    console.warn('Error saving plan', err);
  }
}

// --- Trip History ---
export function getTripHistory(): TripHistoryItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.TRIPS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        apiCall<TripHistoryItem[]>('/trips').then((serverTrips) => {
          if (serverTrips && Array.isArray(serverTrips) && serverTrips.length > 0) {
            localStorage.setItem(STORAGE_KEYS.TRIPS, JSON.stringify(serverTrips));
          }
        });
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Error reading trips', err);
  }

  // Pre-seed realistic past trips
  const seededTrips: TripHistoryItem[] = [
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
    },
  ];

  localStorage.setItem(STORAGE_KEYS.TRIPS, JSON.stringify(seededTrips));
  apiCall<TripHistoryItem[]>('/trips').then((serverTrips) => {
    if (serverTrips && Array.isArray(serverTrips) && serverTrips.length > 0) {
      localStorage.setItem(STORAGE_KEYS.TRIPS, JSON.stringify(serverTrips));
    }
  });
  return seededTrips;
}

export function addTripHistoryItem(item: TripHistoryItem): void {
  const current = getTripHistory();
  const filtered = current.filter((t) => t.id !== item.id);
  const updated = [item, ...filtered];
  localStorage.setItem(STORAGE_KEYS.TRIPS, JSON.stringify(updated.slice(0, 20)));
}
