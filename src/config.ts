import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: process.env.PORT ? parseInt(process.env.PORT, 10) : 3000,
  defaultModel: process.env.DEFAULT_MODEL || 'apple-v1-flash',
  rateLimitFlash: parseInt(process.env.RATE_LIMIT_FLASH || '250', 10),
  rateLimitPro: parseInt(process.env.RATE_LIMIT_PRO || '50', 10),
  rateLimitModels: parseInt(process.env.RATE_LIMIT_MODELS || '100', 10),
};
