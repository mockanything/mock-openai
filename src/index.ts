import express from 'express';
import { config } from './config.js';
import chatRouter from './routes/chat.js';
import modelsRouter from './routes/models.js';
import { accessLogger, serverLogger } from './utils/logger.js';

const app = express();

app.use(express.json({ limit: '10mb' }));

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const cl = res.get('Content-Length') || '-';
    accessLogger.info(`${req.method} ${req.path} ${res.statusCode} ${Date.now() - start}ms ${cl}`);
  });
  next();
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use(modelsRouter);
app.use(chatRouter);

app.listen(config.port, () => {
  serverLogger.info(`[APP] Server started on http://localhost:${config.port}`);
});
