import { Request, Response, NextFunction } from 'express';
import { EmbeddingRequest, EmbeddingResponse } from '../types/openai.js';
import { generateEmbedding, getEmbeddingDimensions, countEmbeddingTokens } from '../services/mock-embeddings.js';

export async function handleEmbedding(req: Request<{}, {}, EmbeddingRequest>, res: Response, _next: NextFunction): Promise<void> {
  const { model = 'text-embedding-3-small', input, dimensions } = req.body;

  const inputs: string[] = Array.isArray(input) ? input : [input];
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
