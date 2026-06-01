import { Request, Response, NextFunction, RequestHandler } from 'express';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function wrapAsync(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>): RequestHandler {
  return (req, res, next) => fn(req, res, next).catch(next);
}

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ApiError) {
    const type = err.status === 401 ? 'authentication_error'
      : err.status === 429 ? 'rate_limit_error'
        : 'invalid_request_error';
    res.status(err.status).json({
      error: { message: err.message, type, code: err.status },
    });
    return;
  }

  res.status(500).json({
    error: { message: 'Internal server error', type: 'server_error', code: 500 },
  });
}
