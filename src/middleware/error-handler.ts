import { ErrorRequestHandler } from 'express';
import { ApiError } from '../utils/errors.js';

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
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
};
