import { Router } from 'express';
import { checkDbConnection, isDbConnected } from '../lib/prisma.js';

const router = Router();

router.get('/', async (_req, res) => {
  const isUp = await checkDbConnection();
  res.json({
    status: 'ok',
    db: isUp ? 'up' : 'demo_mode',
    service: 'ClearRoute AI Logistics Corridor API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

export default router;
