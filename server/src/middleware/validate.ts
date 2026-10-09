import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

export interface ValidationSchemas {
  body?: ZodSchema<any>;
  query?: ZodSchema<any>;
  params?: ZodSchema<any>;
}

export function validate(schemas: ValidationSchemas) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (schemas.params) {
        req.params = await schemas.params.parseAsync(req.params);
      }
      if (schemas.query) {
        req.query = await schemas.query.parseAsync(req.query);
      }
      if (schemas.body) {
        req.body = await schemas.body.parseAsync(req.body);
      }
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const details: Record<string, string[]> = {};
        for (const issue of err.issues) {
          const path = issue.path.join('.') || 'request';
          if (!details[path]) details[path] = [];
          details[path].push(issue.message);
        }
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request data',
            details,
          },
        });
        return;
      }
      next(err);
    }
  };
}
