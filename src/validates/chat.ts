import { Request, Response, NextFunction } from 'express';
import { extractApiKey } from '../utils/helpers.js';
import { ApiError } from '../utils/errors.js';
import { modelIds } from '../templates/index.js';

export function validateChat(req: Request, _res: Response, next: NextFunction): void {
  const { messages, model } = req.body;

  const apiKey = extractApiKey(req);
  if (apiKey === 'default' || !apiKey.startsWith('sk-')) {
    next(new ApiError(401, 'Invalid API key. Please check your API key.'));
    return;
  }

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    next(new ApiError(400, 'Invalid request body: messages is required'));
    return;
  }

  for (const msg of messages) {
    if (!msg.role) {
      next(new ApiError(422, 'Each message must have a "role" field'));
      return;
    }
    if (!msg.content && msg.role !== 'assistant') {
      next(new ApiError(422, `Message with role "${msg.role}" must have content`));
      return;
    }
  }

  if (model && !modelIds.includes(model)) {
    next(new ApiError(422, `Invalid model: "${model}". Please check your model parameter.`));
    return;
  }

  next();
}
