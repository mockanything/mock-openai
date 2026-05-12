import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: process.env.PORT ? parseInt(process.env.PORT, 10) : 3000,
  defaultModel: process.env.DEFAULT_MODEL || 'gpt-3.5-turbo',
  streamDelay: process.env.STREAM_DELAY ? parseInt(process.env.STREAM_DELAY, 10) : 4,
};