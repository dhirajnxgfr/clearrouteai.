import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  DATABASE_URL: z.string().optional().default('postgresql://postgres:postgres@localhost:5432/clearroute?schema=public'),
  DIRECT_URL: z.string().optional(),
  SUPABASE_URL: z.string().optional(),
  SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_JWT_SECRET: z.string().optional(),
  PORT: z.coerce.number().default(8080),
  CORS_ORIGIN: z.string().default('*'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.format());
  throw new Error('Environment configuration validation failed');
}

export const env = parsed.data;

export const corsOrigins = env.CORS_ORIGIN === '*'
  ? ['*']
  : env.CORS_ORIGIN.split(',').map((o) => o.trim());
