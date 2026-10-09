import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { getLocations } from '../services/locations.service.js';

const router = Router();

const locationsQuerySchema = z.object({
  q: z.string().optional(),
});

router.get(
  '/',
  validate({ query: locationsQuerySchema }),
  async (req, res, next) => {
    try {
      const q = req.query.q as string | undefined;
      const locations = await getLocations(q);
      res.json(locations);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
