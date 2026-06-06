import { Request, Response, NextFunction } from 'express';

export function requireApiKey(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: {
        message: 'Missing API key. Provide it via Authorization: Bearer <key>',
        type: 'authentication_error',
        code: 'missing_api_key',
      },
    });
    return;
  }
  const apiKey = authHeader.slice(7).trim();
  if (!apiKey.startsWith('sk-')) {
    res.status(401).json({
      error: {
        message: 'Invalid API key format. Must start with sk-',
        type: 'authentication_error',
        code: 'invalid_api_key_format',
      },
    });
    return;
  }
  next();
}
