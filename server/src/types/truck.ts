export type VehicleType = 'container' | 'tanker' | 'tipper' | 'flatbed';

export type CargoType = 'general' | 'hazardous' | 'perishable';

export interface VehicleProfile {
  id: string;
  name: string;
  type: VehicleType;
  loadedWeightT: number;
  heightM: number;
  widthM: number;
  lengthM: number;
  axles: number;
  defaultCargo: CargoType;
  registrationNumber?: string;
  userId?: string | null;
  isDemo?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export type RestrictionType = 'max_weight_t' | 'max_height_m' | 'max_width_m' | 'time_ban' | 'axle_limit';

export interface Restriction {
  id: string;
  edgeId?: string;
  type: RestrictionType;
  value: number; // e.g. 20 (tonnes), 3.8 (metres), 2.5 (metres)
  label: string;
  locationName: string;
  lat: number;
  lng: number;
  startHour?: number; // 0-23 for time ban
  endHour?: number;   // 0-23 for time ban
  description: string;
  sourceAuthority?: string;
}

export interface RoadNode {
  id: string;
  name: string;
  district: string;
  lat: number;
  lng: number;
  isDemoLocation?: boolean;
}

export interface RoadEdge {
  id: string;
  from: string;
  to: string;
  distanceKm: number;
  baseTimeMin: number;
  tollInr: number;
  roadName: string;
  ghatSection?: boolean;
  laneCount?: number;
  restrictions: Restriction[];
  pathCoordinates: [number, number][]; // [lat, lng] array
}

export type HazardType = 'closure' | 'waterlogging' | 'landslide' | 'accident' | 'weight_check';

export interface DriverReport {
  id: string;
  userId?: string | null;
  type: HazardType;
  title: string;
  locationName: string;
  lat: number;
  lng: number;
  active: boolean;
  severity: 'blocking' | 'caution';
  createdAt: string;
  reportedBy: string;
  affectedEdgeId?: string;
  notes?: string;
}

export interface RouteOption {
  id: string;
  category: 'fastest_legal' | 'safest' | 'lowest_cost';
  title: string;
  subtitle: string;
  timeMin: number;
  distanceKm: number;
  tollInr: number;
  fuelLiters: number;
  fuelCostInr: number;
  totalCostInr: number;
  coordinates: [number, number][];
  edgeIds: string[];
  nodeNames: string[];
  restrictionsEncountered: Restriction[];
  ghatSectionsCount: number;
  explanation: string;
}

export interface RejectedRoute {
  id: string;
  name: string;
  distanceKm: number;
  timeMin: number;
  blockedReason: string;
  violationType: 'weight' | 'height' | 'width' | 'time_ban' | 'report' | 'axles';
  violatingLocation: string;
  coordinates: [number, number][];
}

export interface RoutingPlan {
  id: string;
  userId?: string | null;
  createdAt: string;
  origin: RoadNode;
  destination: RoadNode;
  vehicle: VehicleProfile;
  departureTime: string; // HH:mm
  deadlineTime: string;  // HH:mm
  recommendedRouteId: string;
  routes: RouteOption[];
  rejectedRoutes: RejectedRoute[];
  whyThisRoute: string;
  deadlineMissed?: boolean;
  etaTime?: string;
}

export interface TripHistoryItem {
  id: string;
  userId?: string | null;
  planId?: string;
  date: string;
  originName: string;
  destinationName: string;
  vehicleName: string;
  vehicleType: VehicleType;
  distanceKm: number;
  durationMin: number;
  status: 'completed' | 'active' | 'planned';
  costInr: number;
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt?: string;
}

export interface CorridorGraph {
  nodes: Record<string, RoadNode> | RoadNode[];
  edges: RoadEdge[];
}
