import { Request, Response, NextFunction } from 'express';
import { extractApiKey } from '../utils/helpers.js';
import { ApiError } from '../utils/errors.js';
import { modelIds } from '../templates/index.js';

const embeddingModels = modelIds.filter(m => m.startsWith('text-embedding-'));

export function validateEmbedding(req: Request, _res: Response, next: NextFunction): void {
  const { model, input, dimensions } = req.body;

  const apiKey = extractApiKey(req);
  if (apiKey === 'default' || !apiKey.startsWith('sk-')) {
    next(new ApiError(401, 'Invalid API key. Please check your API key.'));
    return;
  }

  if (!input) {
    next(new ApiError(422, 'input is required'));
    return;
  }

  const inputs: string[] = Array.isArray(input) ? input : [input];

  if (inputs.length === 0) {
    next(new ApiError(422, 'input must not be empty'));
    return;
  }

  if (inputs.some(t => typeof t !== 'string' || t.trim().length === 0)) {
    next(new ApiError(422, 'each input element must be a non-empty string'));
    return;
  }

  if (model && !embeddingModels.includes(model)) {
    next(new ApiError(422, `Invalid model: "${model}". Please check your model parameter.`));
    return;
  }

  if (dimensions !== undefined) {
    if (!Number.isInteger(dimensions) || dimensions < 1) {
      next(new ApiError(422, 'dimensions must be a positive integer'));
      return;
    }
  }

  next();
}
