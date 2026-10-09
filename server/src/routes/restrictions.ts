import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { getRestrictions } from '../services/restrictions.service.js';

const router = Router();

const restrictionsQuerySchema = z.object({
  type: z
    .enum(['max_weight_t', 'max_height_m', 'max_width_m', 'time_ban', 'axle_limit'])
    .optional(),
  minValue: z.coerce.number().optional(),
  maxValue: z.coerce.number().optional(),
  bbox: z.string().optional(),
});

router.get(
  '/',
  validate({ query: restrictionsQuerySchema }),
  async (req, res, next) => {
    try {
      const filters = {
        type: req.query.type as any,
        minValue: req.query.minValue !== undefined ? Number(req.query.minValue) : undefined,
        maxValue: req.query.maxValue !== undefined ? Number(req.query.maxValue) : undefined,
        bbox: req.query.bbox as string | undefined,
      };

      const restrictions = await getRestrictions(filters);
      res.json(restrictions);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
