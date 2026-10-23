import { Request, Response, NextFunction } from 'express';
import { logger } from '../lib/logger';

export interface AppError extends Error {
  status?: number;
  code?: string;
}

export function errorHandler(err: AppError, req: Request, res: Response, _next: NextFunction) {
  const status = err.status || 500;
  const message = status >= 500 ? 'Internal server error' : err.message;

  if (status >= 500) {
    logger.error({ err, method: req.method, url: req.url }, 'Unhandled error');
  }

  res.status(status).json({
    error: {
      message,
      code: err.code || 'INTERNAL_ERROR',
      ...(process.env.NODE_ENV === 'development' && status >= 500
        ? { detail: err.message }
        : {}),
    },
  });
}

export function notFound(req: Request, res: Response) {
  res.status(404).json({
    error: { message: 'Not found', code: 'NOT_FOUND' },
  });
}
