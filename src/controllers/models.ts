import { Request, Response } from 'express';
import { modelIds } from '../templates/index.js';

const models = modelIds.map((id, index) => ({
  id,
  object: 'model',
  created: 1704067200 + index * 86400,
  owned_by: 'unknown',
}));

export function handleListModels(_req: Request, res: Response): void {
  res.json({
    object: 'list',
    data: models,
  });
}
