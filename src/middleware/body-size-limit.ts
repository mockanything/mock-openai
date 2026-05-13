import { Request, Response, NextFunction } from 'express';

const FLASH_MAX = 1 * 1024 * 1024;

export function bodySizeLimit(req: Request, res: Response, next: NextFunction) {
  const model: string = req.body?.model || '';
  const contentLength = parseInt(req.headers['content-length'] || '0', 10);

  if (model.endsWith('-flash') && contentLength > FLASH_MAX) {
    res.status(413).json({
      error: {
        message: 'Request too large for flash model. Maximum allowed size is 1MB.',
        type: 'invalid_request_error',
        code: 413,
      },
    });
    return;
  }

  next();
}
