import { Router } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { validate } from '../middleware/validate.js';
import {
  getReports,
  createReport,
  toggleReportActive,
} from '../services/reports.service.js';

const router = Router();

// Rate limit: 10 reports per hour per IP / user
const reportRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { keyGeneratorIpFallback: false },
  keyGenerator: (req) => {
    return req.user?.id || req.guestId || req.ip || 'anonymous';
  },
  message: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Driver hazard report limit reached (max 10 submissions per hour). Please try again later.',
    },
  },
});

const reportQuerySchema = z.object({
  active: z
    .string()
    .optional()
    .transform((val) => (val === undefined ? undefined : val === 'true')),
});

const reportBodySchema = z.object({
  type: z.enum(['closure', 'waterlogging', 'landslide', 'accident', 'weight_check']),
  title: z.string().min(3, 'Title must be at least 3 characters'),
  locationName: z.string().min(2, 'Location name must be at least 2 characters'),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  severity: z.enum(['blocking', 'caution']),
  affectedEdgeId: z.string().optional(),
  notes: z.string().optional(),
  reportedBy: z.string().optional(),
});

const reportParamsSchema = z.object({
  id: z.string().min(1),
});

// GET /reports -> DriverReport[] (?active=true, newest first)
router.get(
  '/',
  validate({ query: reportQuerySchema }),
  async (req, res, next) => {
    try {
      const activeOnly = req.query.active as boolean | undefined;
      const reports = await getReports(activeOnly);
      res.json(reports);
    } catch (err) {
      next(err);
    }
  }
);

// POST /reports -> create
router.post(
  '/',
  reportRateLimiter,
  validate({ body: reportBodySchema }),
  async (req, res, next) => {
    try {
      const userId = req.user?.id || null;
      const userEmail = req.user?.email;
      const created = await createReport(req.body, userId, userEmail);
      res.status(201).json(created);
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /reports/:id/active -> toggle active
router.patch(
  '/:id/active',
  validate({ params: reportParamsSchema }),
  async (req, res, next) => {
    try {
      const updated = await toggleReportActive(req.params.id);
      res.json(updated);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
