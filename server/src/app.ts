import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { env, corsOrigins } from './config/env.js';
import { authenticate } from './middleware/auth.js';
import { errorHandler } from './middleware/errorHandler.js';

import healthRoutes from './routes/health.js';
import locationsRoutes from './routes/locations.js';
import vehiclesRoutes from './routes/vehicles.js';
import restrictionsRoutes from './routes/restrictions.js';
import reportsRoutes from './routes/reports.js';
import plansRoutes from './routes/plans.js';
import tripsRoutes from './routes/trips.js';
import coverageRoutes from './routes/coverage.js';

export const app = express();

// Security Headers
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// CORS configuration
app.use(
  cors({
    origin: (origin, callback) => {
      // allow requests with no origin (like mobile apps, curl, or test tools)
      if (!origin) return callback(null, true);
      if (corsOrigins.includes('*') || corsOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-guest-id'],
  })
);

// JSON body parser with strict 100kb limit
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

// Request Logging
if (env.NODE_ENV !== 'test') {
  app.use(
    morgan(':method :url :status :res[content-length] - :response-time ms')
  );
}

// Global Rate Limiting: 100 requests per 15 minutes
const globalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests. Please try again in a few minutes.',
    },
  },
});

app.use('/api', globalRateLimiter);

// Optional authentication / guest middleware across all endpoints
app.use('/api', authenticate);

// API v1 Router
const apiV1 = express.Router();
apiV1.use('/health', healthRoutes);
apiV1.use('/locations', locationsRoutes);
apiV1.use('/vehicles', vehiclesRoutes);
apiV1.use('/restrictions', restrictionsRoutes);
apiV1.use('/reports', reportsRoutes);
apiV1.use('/plans', plansRoutes);
apiV1.use('/trips', tripsRoutes);
apiV1.use('/coverage', coverageRoutes);

app.use('/api/v1', apiV1);

// 404 handler for undefined API routes
app.use('/api/*', (_req, res) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: 'The requested API endpoint does not exist',
    },
  });
});

// Central Error Handler
app.use(errorHandler);
