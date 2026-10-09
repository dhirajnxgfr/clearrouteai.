import { Router } from 'express';
import { getCoverageInfo } from '../services/coverage.service.js';

const router = Router();

router.get('/', (_req, res) => {
  res.json(getCoverageInfo());
});

export default router;
