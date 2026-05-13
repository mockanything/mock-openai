import express from 'express';
import { config } from './config.js';
import chatRouter from './routes/chat.js';
import modelsRouter from './routes/models.js';

const app = express();

app.use(express.json({ limit: '10mb' }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use(modelsRouter);
app.use(chatRouter);

app.listen(config.port, () => {
  console.log(`Mock OpenAI server running on http://localhost:${config.port}`);
});