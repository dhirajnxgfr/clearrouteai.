# ClearRoute AI — Backend Service & Routing Engine

Production-grade Express + TypeScript REST API and pure graph routing engine for heavy-vehicle-aware corridor navigation along the Mumbai (JNPT Port) to Pune (Chakan MIDC) industrial freight corridor.

---

## 🛠️ Stack

- **Runtime**: Node.js 20+ (ESM modules)
- **Framework**: Express.js with TypeScript (`tsx` for dev, `tsc` for production)
- **Database & ORM**: Supabase (PostgreSQL) + Prisma ORM
- **Authentication**: Supabase Auth (JWT Bearer tokens) + Guest mode via `x-guest-id`
- **Validation**: Zod schema validation on all inputs
- **Security**: Helmet, CORS origin restriction, 100kb body limit, express-rate-limit
- **Testing**: Vitest + Supertest (23 unit and integration tests)

---

## 🚀 Step-by-Step Setup Guide

### 1. Create a Supabase Project

1. Log in to [supabase.com](https://supabase.com) and create a new project (e.g. `clearroute-db`).
2. Select your region (e.g. **Mumbai, India - `ap-south-1`** for the lowest corridor latency).
3. Set a strong database password and copy it.

### 2. Copy Database Connection Strings

Under **Project Settings** -> **Database**:
- **Pooled Connection String** (Transaction pooler, Port `6543`):
  ```
  postgresql://postgres.[REF]:[PASSWORD]@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1
  ```
- **Direct Connection String** (Session direct, Port `5432`):
  ```
  postgresql://postgres.[REF]:[PASSWORD]@aws-0-ap-south-1.pooler.supabase.com:5432/postgres
  ```

### 3. Configure Environment Variables

In the `server/` directory, create a `.env` file based on `.env.example`:

```bash
cp .env.example .env
```

Fill in your variables:

```env
DATABASE_URL="postgresql://postgres.[REF]:[PASSWORD]@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"
DIRECT_URL="postgresql://postgres.[REF]:[PASSWORD]@aws-0-ap-south-1.pooler.supabase.com:5432/postgres"
SUPABASE_URL="https://[REF].supabase.co"
SUPABASE_ANON_KEY="eyJhbGciOi..."
SUPABASE_JWT_SECRET="your-jwt-secret"
PORT=8080
CORS_ORIGIN="http://localhost:5173,http://localhost:3000,https://clearroute-ai.vercel.app"
NODE_ENV="development"
```

### 4. Run Prisma Migrations & Database Seed

```bash
# 1. Generate Prisma Client
npm run db:generate

# 2. Apply migration to Supabase PostgreSQL
npm run db:migrate

# 3. Seed road graph, restrictions, demo vehicles, and reports
npm run db:seed
```

One command fills the database with:
- 21 corridor road nodes (`jnpt_gate`, `chakan_midc`, `khandala_top`, etc.)
- 23 high-fidelity directional edges with coordinates, tolls, and lane configurations
- 6 bridge/underpass/time-ban restrictions
- 4 realistic demo commercial vehicles (40ft Container, POL Tanker, Heavy Tipper, Flatbed)
- Active community driver reports

### 5. Start the Server

```bash
# Development (with auto-reload)
npm run dev

# Run test suite (Vitest)
npm run test

# Build & Run for Production
npm run build
npm start
```

---

## 📡 Example `curl` Commands

### 1. Health Check
```bash
curl -X GET http://localhost:8080/api/v1/health
```

### 2. Search Autocomplete Locations
```bash
curl -X GET "http://localhost:8080/api/v1/locations?q=JNPT"
```

### 3. Calculate Truck Routing Plan (JNPT to Chakan MIDC)
```bash
curl -X POST http://localhost:8080/api/v1/plans \
  -H "Content-Type: application/json" \
  -d '{
    "originId": "jnpt_gate",
    "destinationId": "chakan_midc",
    "vehicleId": "veh_container_40ft",
    "departureTime": "08:30",
    "deadlineTime": "18:00"
  }'
```

### 4. Create a Driver Hazard Report
```bash
curl -X POST http://localhost:8080/api/v1/reports \
  -H "Content-Type: application/json" \
  -H "x-guest-id: driver_ramesh" \
  -d '{
    "type": "landslide",
    "title": "Bhor Ghat rockfall on single lane",
    "locationName": "Old NH 48 Bhor Ghat Hairpin 4",
    "lat": 18.7650,
    "lng": 73.3700,
    "severity": "blocking",
    "affectedEdgeId": "e_khopoli_amrutanjan_old",
    "notes": "Police redirecting all heavy trailers to the Expressway"
  }'
```

### 5. Toggle Hazard Report Active State
```bash
curl -X PATCH http://localhost:8080/api/v1/reports/rep_001/active
```

---

## 🔄 Frontend Integration Guide (`services/storage.ts` Replacement)

Replace the client-side `localStorage` implementation in your frontend (`CLEARROUTE.ai/src/services/storage.ts`) with real API calls:

```typescript
// src/services/apiClient.ts
import { supabase } from './supabaseClient'; // your frontend Supabase client

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1';

function getGuestId(): string {
  let guestId = localStorage.getItem('clearroute_guest_id');
  if (!guestId) {
    guestId = 'guest_' + crypto.randomUUID();
    localStorage.setItem('clearroute_guest_id', guestId);
  }
  return guestId;
}

export async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const session = (await supabase.auth.getSession()).data.session;
  const token = session?.access_token;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-guest-id': getGuestId(),
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || 'API request failed');
  }

  return data;
}

// -------------------------------------------------------------
// Replacements for storage.ts functions:
// -------------------------------------------------------------

// 1. Vehicles
export async function getSavedVehicles(): Promise<VehicleProfile[]> {
  return apiFetch<VehicleProfile[]>('/vehicles');
}

export async function saveVehicle(vehicle: Omit<VehicleProfile, 'id'> | VehicleProfile): Promise<VehicleProfile> {
  if ('id' in vehicle && vehicle.id && !vehicle.id.startsWith('custom_')) {
    return apiFetch<VehicleProfile>(`/vehicles/${vehicle.id}`, {
      method: 'PUT',
      body: JSON.stringify(vehicle),
    });
  }
  return apiFetch<VehicleProfile>('/vehicles', {
    method: 'POST',
    body: JSON.stringify(vehicle),
  });
}

export async function deleteVehicle(id: string): Promise<void> {
  await apiFetch(`/vehicles/${id}`, { method: 'DELETE' });
}

// 2. Driver Reports
export async function getSavedReports(): Promise<DriverReport[]> {
  return apiFetch<DriverReport[]>('/reports');
}

export async function addDriverReport(report: Omit<DriverReport, 'id' | 'createdAt'>): Promise<DriverReport> {
  return apiFetch<DriverReport>('/reports', {
    method: 'POST',
    body: JSON.stringify(report),
  });
}

export async function toggleReportActive(reportId: string): Promise<DriverReport> {
  return apiFetch<DriverReport>(`/reports/${reportId}/active`, {
    method: 'PATCH',
  });
}

// 3. Routing Plans & Trips
export async function computeAndSavePlan(
  originId: string,
  destinationId: string,
  vehicleId: string,
  departureTime = '08:30',
  deadlineTime = '18:00'
): Promise<RoutingPlan> {
  return apiFetch<RoutingPlan>('/plans', {
    method: 'POST',
    body: JSON.stringify({ originId, destinationId, vehicleId, departureTime, deadlineTime }),
  });
}

export async function getSavedPlan(planId: string): Promise<RoutingPlan> {
  return apiFetch<RoutingPlan>(`/plans/${planId}`);
}

export async function reroutePlan(planId: string): Promise<{ plan: RoutingPlan; changes: string }> {
  return apiFetch<{ plan: RoutingPlan; changes: string }>(`/plans/${planId}/reroute`, {
    method: 'POST',
  });
}

// 4. Trip History
export async function getTripHistory(): Promise<TripHistoryItem[]> {
  return apiFetch<TripHistoryItem[]>('/trips');
}

export async function updateTripStatus(
  tripId: string,
  status: 'planned' | 'active' | 'completed'
): Promise<TripHistoryItem> {
  return apiFetch<TripHistoryItem>(`/trips/${tripId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}
```

---

## ☁️ Deployment Notes (Render & Railway)

Express needs a persistent Node.js runtime process (long-running server), **not Vercel serverless functions**, to maintain Prisma connection pooling and WebSocket/rate-limit state.

### Deploying on Railway

1. Push your repository to GitHub.
2. In Railway Dashboard, click **New Project** -> **Deploy from GitHub repo**.
3. Select the `server` directory as the Root Directory (or deploy from repository root).
4. Configure Build and Start commands:
   - **Build Command**: `npm install && npx prisma generate && npm run build`
   - **Start Command**: `npm start`
5. In **Variables**, add:
   - `DATABASE_URL` (Supabase pooled URL with `?pgbouncer=true&connection_limit=1`)
   - `DIRECT_URL` (Supabase direct URL)
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `PORT=8080` (Railway automatically binds `PORT`)
   - `CORS_ORIGIN=https://clearroute-ai.vercel.app`
   - `NODE_ENV=production`

### Deploying on Render

1. Create a **New Web Service** connected to your repo.
2. Select **Node** environment.
3. Set **Root Directory**: `server`
4. Set **Build Command**:
   ```bash
   npm install && npx prisma generate && npm run build
   ```
5. Set **Start Command**:
   ```bash
   npm start
   ```
6. Add the environment variables from `.env.example`.
7. Once deployed, run `npx prisma db seed` via the Render Shell tab to populate the production corridor graph!
