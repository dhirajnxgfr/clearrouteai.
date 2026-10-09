import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { getTrips, updateTripStatus } from '../services/trips.service.js';

const router = Router();

const tripStatusSchema = z.object({
  status: z.enum(['planned', 'active', 'completed']),
});

const tripParamsSchema = z.object({
  id: z.string().min(1),
});

// GET /trips -> TripHistoryItem[] for current user/guest
router.get('/', async (req, res, next) => {
  try {
    const userId = req.user?.id || null;
    const guestId = req.guestId || null;
    const trips = await getTrips(userId, guestId);
    res.json(trips);
  } catch (err) {
    next(err);
  }
});

// PATCH /trips/:id/status -> planned -> active -> completed
router.patch(
  '/:id/status',
  validate({ params: tripParamsSchema, body: tripStatusSchema }),
  async (req, res, next) => {
    try {
      const userId = req.user?.id || null;
      const guestId = req.guestId || null;
      const updated = await updateTripStatus(req.params.id, req.body.status, userId, guestId);
      res.json(updated);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
