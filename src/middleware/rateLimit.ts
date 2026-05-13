import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { config } from '../config.js';

function getModelSuffix(model: string): string {
  if (model.endsWith('-pro')) return 'pro';
  if (model.endsWith('-flash')) return 'flash';
  return 'other';
}

export const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const model = (req.body?.model as string) || config.defaultModel;
    return `${ipKeyGenerator(req.ip || '127.0.0.1')}:${getModelSuffix(model)}`;
  },
  max: (req) => {
    const model = (req.body?.model as string) || config.defaultModel;
    if (model.endsWith('-pro')) return config.rateLimitPro;
    return config.rateLimitFlash;
  },
  handler: (_req, res) => {
    res.status(429).json({
      error: {
        message: 'Rate limit exceeded. Please pace your requests.',
        type: 'rate_limit_error',
        code: 429,
      },
    });
  },
});
