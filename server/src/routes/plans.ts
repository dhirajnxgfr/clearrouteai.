import { Router } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { validate } from '../middleware/validate.js';
import {
  createPlan,
  getPlanById,
  reroutePlan,
} from '../services/plans.service.js';

const router = Router();

// Stricter rate limit on planning requests
const planRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Route calculation rate limit exceeded (max 30 calculations per 15 minutes).',
    },
  },
});

const vehicleProfileSchema = z.object({
  id: z.string().optional().default('custom_vehicle'),
  name: z.string().min(1),
  type: z.enum(['container', 'tanker', 'tipper', 'flatbed']),
  loadedWeightT: z.number().min(1).max(60),
  heightM: z.number().min(2).max(5),
  widthM: z.number().min(1.5).max(3.5),
  lengthM: z.number().min(3).max(30),
  axles: z.number().int().min(2).max(9),
  defaultCargo: z.enum(['general', 'hazardous', 'perishable']),
  registrationNumber: z.string().optional(),
});

const timeStringRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

const createPlanSchema = z
  .object({
    originId: z.string().min(1, 'Origin node ID is required'),
    destinationId: z.string().min(1, 'Destination node ID is required'),
    vehicleId: z.string().optional(),
    vehicle: vehicleProfileSchema.optional(),
    departureTime: z
      .string()
      .regex(timeStringRegex, 'Departure time must be in HH:mm format')
      .optional()
      .default('08:30'),
    deadlineTime: z
      .string()
      .regex(timeStringRegex, 'Deadline time must be in HH:mm format')
      .optional()
      .default('18:00'),
  })
  .refine((data) => data.vehicleId || data.vehicle, {
    message: 'Either vehicleId or inline vehicle profile must be provided',
    path: ['vehicleId'],
  });

const planParamsSchema = z.object({
  id: z.string().min(1),
});

// POST /plans -> create plan & trip
router.post(
  '/',
  planRateLimiter,
  validate({ body: createPlanSchema }),
  async (req, res, next) => {
    try {
      const userId = req.user?.id || null;
      const guestId = req.guestId || null;
      const plan = await createPlan(req.body, userId, guestId);
      res.status(201).json(plan);
    } catch (err) {
      next(err);
    }
  }
);

// GET /plans/:id -> RoutingPlan
router.get(
  '/:id',
  validate({ params: planParamsSchema }),
  async (req, res, next) => {
    try {
      const plan = await getPlanById(req.params.id);
      if (!plan) {
        res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: 'Routing plan not found',
          },
        });
        return;
      }
      res.json(plan);
    } catch (err) {
      next(err);
    }
  }
);

// POST /plans/:id/reroute -> recompute plan
router.post(
  '/:id/reroute',
  validate({ params: planParamsSchema }),
  async (req, res, next) => {
    try {
      const result = await reroutePlan(req.params.id);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
