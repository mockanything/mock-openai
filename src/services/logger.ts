import winston from 'winston';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const logDir = join(__dirname, '../../logs');
const isProd = process.env.NODE_ENV === 'production';

const consoleTransport = new winston.transports.Console({
  format: winston.format.printf(({ message }) => message as string),
});

const accessTransport = new winston.transports.File({
  filename: join(logDir, 'access.log'),
  format: winston.format.printf(({ message }) => message as string),
});

const serverTransport = new winston.transports.File({
  filename: join(logDir, 'server.log'),
  format: winston.format.printf(({ message }) => message as string),
});

export const accessLogger = winston.createLogger({
  transports: isProd
    ? [accessTransport]
    : [accessTransport, consoleTransport],
});

export const serverLogger = winston.createLogger({
  transports: isProd
    ? [serverTransport]
    : [serverTransport, consoleTransport],
});
