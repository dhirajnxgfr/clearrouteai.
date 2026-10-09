import { Request, Response, NextFunction } from 'express';
import { NoLegalRouteError } from '../engine/routingEngine.js';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: any;

  constructor(message: string, statusCode: number = 400, code: string = 'BAD_REQUEST', details?: any) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export function errorHandler(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // 1. Handle NoLegalRouteError from Routing Engine (422)
  if (err instanceof NoLegalRouteError) {
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        details: {
          blockingReasons: err.blockingReasons,
        },
      },
    });
    return;
  }

  // 2. Handle custom AppError
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
    });
    return;
  }

  // 3. Handle Prisma Errors
  if (err?.code?.startsWith('P')) {
    if (err.code === 'P2002') {
      res.status(409).json({
        error: {
          code: 'CONFLICT',
          message: 'A resource with this unique field already exists',
          details: { target: err.meta?.target },
        },
      });
      return;
    }
    if (err.code === 'P2025') {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'The requested resource was not found',
        },
      });
      return;
    }
    if (err.code === 'P2003') {
      res.status(400).json({
        error: {
          code: 'FOREIGN_KEY_VIOLATION',
          message: 'Referenced entity does not exist',
        },
      });
      return;
    }
  }

  // 4. Handle SyntaxError (e.g. malformed JSON body)
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({
      error: {
        code: 'BAD_REQUEST',
        message: 'Malformed JSON payload in request body',
      },
    });
    return;
  }

  // 5. Default 500 Internal Server Error (Never leak stack trace in production)
  const isDev = process.env.NODE_ENV === 'development';
  console.error('Unhandled server error:', err);

  res.status(err.status || 500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: isDev ? err.message || 'Internal server error' : 'An internal server error occurred',
      ...(isDev && err.stack ? { details: err.stack } : {}),
    },
  });
}
