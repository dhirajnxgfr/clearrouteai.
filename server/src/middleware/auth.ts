import { Request, Response, NextFunction } from 'express';
import { verifySupabaseToken, AuthenticatedUser } from '../lib/supabase.js';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser | null;
      guestId?: string | null;
    }
  }
}

/**
 * Optional Authentication Middleware:
 * Verifies Bearer token if present; otherwise permits guest access via x-guest-id
 */
export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  const guestHeader = req.headers['x-guest-id'];

  req.user = null;
  req.guestId = typeof guestHeader === 'string' && guestHeader.trim() ? guestHeader.trim() : null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    if (token) {
      const user = await verifySupabaseToken(token);
      if (!user) {
        res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Invalid or expired authorization token',
          },
        });
        return;
      }
      req.user = user;
    }
  }

  next();
}

/**
 * Strict Authentication Middleware:
 * Rejects requests without a valid authenticated user
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required. Please provide a valid Bearer token.',
      },
    });
    return;
  }
  next();
}

/**
 * Helper to get the actor identity (authenticated user ID or guest ID)
 */
export function getActorId(req: Request): { userId: string | null; guestId: string | null; actorKey: string } {
  if (req.user?.id) {
    return { userId: req.user.id, guestId: null, actorKey: req.user.id };
  }
  const guest = req.guestId || 'guest_demo';
  return { userId: null, guestId: guest, actorKey: guest };
}
