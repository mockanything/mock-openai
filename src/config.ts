import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: process.env.PORT ? parseInt(process.env.PORT, 10) : 3000,
  defaultModel: process.env.DEFAULT_MODEL || 'apple-v1-flash',
};