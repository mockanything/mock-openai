import { Router, Request, Response } from 'express';
import { ChatCompletionRequest } from '../types/openai.js';
import { createNonStreamingResponse, createStreamingResponse } from '../services/mock.js';
import { config } from '../config.js';

const router = Router();

router.post('/v1/chat/completions', (req: Request<{}, {}, ChatCompletionRequest>, res: Response) => {
  const { model = config.defaultModel, messages, stream = false } = req.body;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: 'messages is required' });
    return;
  }

  if (stream) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const generator = createStreamingResponse(model, messages);

    const sendChunk = (): void => {
      const result = generator.next();
      if (result.done) {
        res.write(`data: [DONE]\n\n`);
        res.end();
        return;
      }

      res.write(`data: ${JSON.stringify(result.value)}\n\n`);

      setTimeout(sendChunk, config.streamDelay);
    };

    sendChunk();
    return;
  }

  const response = createNonStreamingResponse(model, messages);
  res.json(response);
});

export default router;