import { Request, Response } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { config } from '../config.js';
import { extractApiKey } from '../utils/helpers.js';

function getModelSuffix(model: string): string {
  if (model.endsWith('-pro')) return 'pro';
  if (model.endsWith('-flash')) return 'flash';
  return 'other';
}

const rateLimitOptions = {
  windowMs: 60 * 1000,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req: Request, res: Response) => {
    res.status(429).json({
      error: {
        message: 'Rate limit exceeded. Please pace your requests.',
        type: 'rate_limit_error',
        code: 429,
      },
    });
  },
};

export const chatLimiter = rateLimit({
  ...rateLimitOptions,
  keyGenerator: (req) => {
    const model = (req.body?.model as string) || config.defaultModel;
    const apiKey = extractApiKey(req);
    return `${ipKeyGenerator(req.ip || '127.0.0.1')}:${getModelSuffix(model)}`;
  },
  max: (req) => {
    const model = (req.body?.model as string) || config.defaultModel;
    if (model.endsWith('-pro')) return config.rateLimitPro;
    return config.rateLimitFlash;
  },
});

export const modelsLimiter = rateLimit({
  ...rateLimitOptions,
  keyGenerator: (req) => ipKeyGenerator(req.ip || '127.0.0.1'),
  max: config.rateLimitModels,
});
