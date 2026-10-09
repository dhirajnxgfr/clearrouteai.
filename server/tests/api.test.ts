import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { inMemoryStore } from '../src/services/store.js';

describe('ClearRoute AI REST API Tests', () => {
  beforeEach(() => {
    inMemoryStore.reset();
  });

  describe('GET /api/v1/health', () => {
    it('returns 200 with status ok and db status', async () => {
      const res = await request(app).get('/api/v1/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.service).toContain('ClearRoute AI');
    });
  });

  describe('GET /api/v1/coverage', () => {
    it('returns coverage details and hackathon disclaimer', async () => {
      const res = await request(app).get('/api/v1/coverage');
      expect(res.status).toBe(200);
      expect(res.body.corridor).toContain('JNPT');
      expect(res.body.supportedVehicleTypes).toContain('container');
      expect(res.body.disclaimer).toBeDefined();
    });
  });

  describe('GET /api/v1/locations', () => {
    it('returns road nodes autocomplete list', async () => {
      const res = await request(app).get('/api/v1/locations');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body[0]).toHaveProperty('id');
      expect(res.body[0]).toHaveProperty('name');
    });

    it('filters road nodes by query param ?q=', async () => {
      const res = await request(app).get('/api/v1/locations?q=JNPT');
      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body.some((n: any) => n.id === 'jnpt_gate')).toBe(true);
    });
  });

  describe('Vehicle Endpoints (/api/v1/vehicles)', () => {
    it('GET /vehicles returns shared demo vehicles', async () => {
      const res = await request(app).get('/api/v1/vehicles');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('POST /vehicles creates a new vehicle when valid', async () => {
      const newVehicle = {
        name: 'Ashok Leyland Captain 40i',
        type: 'container',
        loadedWeightT: 32.5,
        heightM: 4.1,
        widthM: 2.5,
        lengthM: 14.2,
        axles: 5,
        defaultCargo: 'general',
        registrationNumber: 'MH 14 AB 1234',
      };

      const res = await request(app)
        .post('/api/v1/vehicles')
        .set('x-guest-id', 'test_guest_1')
        .send(newVehicle);

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.name).toBe(newVehicle.name);
      expect(res.body.loadedWeightT).toBe(32.5);
    });

    it('POST /vehicles returns 400 with field errors if values violate limits', async () => {
      const invalidVehicle = {
        name: 'Overloaded Super Heavy Rig',
        type: 'container',
        loadedWeightT: 95.0, // max 60
        heightM: 7.2,        // max 5
        widthM: 5.0,         // max 3.5
        lengthM: 45.0,       // max 30
        axles: 15,           // max 9
        defaultCargo: 'general',
      };

      const res = await request(app)
        .post('/api/v1/vehicles')
        .send(invalidVehicle);

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details).toBeDefined();
    });

    it('DELETE /vehicles/:id rejects deleting shared demo vehicles', async () => {
      const res = await request(app).delete('/api/v1/vehicles/veh_container_40ft');
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('Driver Reports (/api/v1/reports)', () => {
    it('GET /reports returns community driver reports', async () => {
      const res = await request(app).get('/api/v1/reports?active=true');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body.every((r: any) => r.active === true)).toBe(true);
    });

    it('POST /reports creates a new driver report', async () => {
      const newReport = {
        type: 'waterlogging',
        title: 'Water accumulation under Talegaon flyover',
        locationName: 'Talegaon Dabhade',
        lat: 18.729,
        lng: 73.652,
        severity: 'caution',
        notes: 'Water depth ~20cm. Trucks can pass slowly.',
      };

      const res = await request(app)
        .post('/api/v1/reports')
        .send(newReport);

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.active).toBe(true);
    });

    it('PATCH /reports/:id/active toggles active state', async () => {
      const res = await request(app).patch('/api/v1/reports/rep_001/active');
      expect(res.status).toBe(200);
      expect(res.body.active).toBe(false);

      const res2 = await request(app).patch('/api/v1/reports/rep_001/active');
      expect(res2.status).toBe(200);
      expect(res2.body.active).toBe(true);
    });
  });

  describe('Routing Plans (/api/v1/plans)', () => {
    it('POST /plans computes route plan and creates a planned trip', async () => {
      const res = await request(app)
        .post('/api/v1/plans')
        .send({
          originId: 'jnpt_gate',
          destinationId: 'chakan_midc',
          vehicleId: 'veh_container_40ft',
          departureTime: '08:30',
          deadlineTime: '18:00',
        });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.origin.id).toBe('jnpt_gate');
      expect(res.body.destination.id).toBe('chakan_midc');
      expect(res.body.routes.length).toBeGreaterThan(0);
      expect(res.body.whyThisRoute).toBeDefined();

      const planId = res.body.id;

      // GET /plans/:id
      const getRes = await request(app).get(`/api/v1/plans/${planId}`);
      expect(getRes.status).toBe(200);
      expect(getRes.body.id).toBe(planId);

      // POST /plans/:id/reroute
      const rerouteRes = await request(app).post(`/api/v1/plans/${planId}/reroute`);
      expect(rerouteRes.status).toBe(200);
      expect(rerouteRes.body.plan).toBeDefined();
      expect(rerouteRes.body.changes).toBeDefined();
    });

    it('POST /plans returns 400 if missing vehicle or node', async () => {
      const res = await request(app)
        .post('/api/v1/plans')
        .send({
          originId: 'jnpt_gate',
          destinationId: 'chakan_midc',
          // no vehicleId or vehicle
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Trip History (/api/v1/trips)', () => {
    it('GET /trips returns past trip history', async () => {
      const res = await request(app).get('/api/v1/trips');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('PATCH /trips/:id/status updates status from planned to active to completed', async () => {
      const res = await request(app)
        .patch('/api/v1/trips/trip_demo_1/status')
        .send({ status: 'completed' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('completed');
    });
  });
});
