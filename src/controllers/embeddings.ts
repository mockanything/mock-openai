import { Request, Response } from 'express';
import { EmbeddingRequest, EmbeddingResponse } from '../types/openai.js';
import { generateEmbedding, getEmbeddingDimensions, countEmbeddingTokens } from '../services/mock-embeddings.js';
import { generateId } from '../utils/helpers.js';

export function handleEmbedding(req: Request<{}, {}, EmbeddingRequest>, res: Response): void {
  const { model = 'text-embedding-3-small', input, dimensions } = req.body;

  if (!input) {
    res.status(400).json({ error: { message: 'input is required', type: 'invalid_request_error', code: 400 } });
    return;
  }

  // Normalize input to array
  const inputs: string[] = Array.isArray(input) ? input : [input];

  if (inputs.length === 0) {
    res.status(400).json({ error: { message: 'input must not be empty', type: 'invalid_request_error', code: 400 } });
    return;
  }

  if (inputs.some(t => typeof t !== 'string' || t.trim().length === 0)) {
    res.status(400).json({ error: { message: 'each input element must be a non-empty string', type: 'invalid_request_error', code: 400 } });
    return;
  }

  const dims = dimensions || getEmbeddingDimensions(model);
  const promptTokens = countEmbeddingTokens(inputs);
  const data = inputs.map((text, index) => ({
    object: 'embedding' as const,
    index,
    embedding: generateEmbedding(text, dims),
  }));

  const response: EmbeddingResponse = {
    object: 'list',
    data,
    model,
    usage: {
      prompt_tokens: promptTokens,
      total_tokens: promptTokens,
    },
  };

  res.json(response);
}
