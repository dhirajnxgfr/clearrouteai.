import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import {
  getVehicles,
  getVehicleById,
  createVehicle,
  updateVehicle,
  deleteVehicle,
} from '../services/vehicles.service.js';

const router = Router();

const vehicleBodySchema = z.object({
  name: z.string().min(1, 'Vehicle name is required'),
  type: z.enum(['container', 'tanker', 'tipper', 'flatbed']),
  loadedWeightT: z
    .number()
    .min(1, 'Weight must be at least 1 t')
    .max(60, 'Weight cannot exceed 60 t'),
  heightM: z
    .number()
    .min(2, 'Height must be at least 2 m')
    .max(5, 'Height cannot exceed 5 m'),
  widthM: z
    .number()
    .min(1.5, 'Width must be at least 1.5 m')
    .max(3.5, 'Width cannot exceed 3.5 m'),
  lengthM: z
    .number()
    .min(3, 'Length must be at least 3 m')
    .max(30, 'Length cannot exceed 30 m'),
  axles: z
    .number()
    .int('Axles must be an integer')
    .min(2, 'Axles must be at least 2')
    .max(9, 'Axles cannot exceed 9'),
  defaultCargo: z.enum(['general', 'hazardous', 'perishable']),
  registrationNumber: z.string().optional(),
});

const vehicleUpdateSchema = vehicleBodySchema.partial();

const vehicleParamsSchema = z.object({
  id: z.string().min(1),
});

// GET /vehicles -> own vehicles plus shared demo vehicles
router.get('/', async (req, res, next) => {
  try {
    const userId = req.user?.id || null;
    const guestId = req.guestId || null;
    const vehicles = await getVehicles(userId, guestId);
    res.json(vehicles);
  } catch (err) {
    next(err);
  }
});

// GET /vehicles/:id
router.get(
  '/:id',
  validate({ params: vehicleParamsSchema }),
  async (req, res, next) => {
    try {
      const vehicle = await getVehicleById(req.params.id);
      if (!vehicle) {
        res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: 'Vehicle not found',
          },
        });
        return;
      }
      res.json(vehicle);
    } catch (err) {
      next(err);
    }
  }
);

// POST /vehicles -> create
router.post(
  '/',
  validate({ body: vehicleBodySchema }),
  async (req, res, next) => {
    try {
      const userId = req.user?.id || null;
      const guestId = req.guestId || null;
      const created = await createVehicle(req.body, userId, guestId);
      res.status(201).json(created);
    } catch (err) {
      next(err);
    }
  }
);

// PUT /vehicles/:id -> update
router.put(
  '/:id',
  validate({ params: vehicleParamsSchema, body: vehicleUpdateSchema }),
  async (req, res, next) => {
    try {
      const userId = req.user?.id || null;
      const guestId = req.guestId || null;
      const updated = await updateVehicle(req.params.id, req.body, userId, guestId);
      res.json(updated);
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /vehicles/:id -> delete
router.delete(
  '/:id',
  validate({ params: vehicleParamsSchema }),
  async (req, res, next) => {
    try {
      const userId = req.user?.id || null;
      const guestId = req.guestId || null;
      await deleteVehicle(req.params.id, userId, guestId);
      res.json({ success: true, message: 'Vehicle deleted successfully' });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
