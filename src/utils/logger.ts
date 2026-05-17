import winston from 'winston';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const logDir = join(__dirname, '../../logs');
const isProd = process.env.NODE_ENV === 'production';

const ts = winston.format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' });

const logFmt = winston.format.printf(({ timestamp, message }) => `[${timestamp}] ${message}`);

const consoleTransport = new winston.transports.Console({
  format: winston.format.combine(ts, logFmt),
});

const accessTransport = new winston.transports.File({
  filename: join(logDir, 'access.log'),
  format: winston.format.combine(ts, logFmt),
});

const serverTransport = new winston.transports.File({
  filename: join(logDir, 'server.log'),
  format: winston.format.combine(ts, logFmt),
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
