import { Request, Response, NextFunction } from 'express';
import { EmbeddingRequest, EmbeddingResponse } from '../types/openai.js';
import { generateEmbedding, getEmbeddingDimensions, countEmbeddingTokens } from '../services/mock-embeddings.js';
import { generateId } from '../utils/helpers.js';
import { ApiError } from '../utils/errors.js';

export async function handleEmbedding(req: Request<{}, {}, EmbeddingRequest>, res: Response, _next: NextFunction): Promise<void> {
  const { model = 'text-embedding-3-small', input, dimensions } = req.body;

  if (!input) {
    throw new ApiError(422, 'input is required');
  }

  // Normalize input to array
  const inputs: string[] = Array.isArray(input) ? input : [input];

  if (inputs.length === 0) {
    throw new ApiError(422, 'input must not be empty');
  }

  if (inputs.some(t => typeof t !== 'string' || t.trim().length === 0)) {
    throw new ApiError(422, 'each input element must be a non-empty string');
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
