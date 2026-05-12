import { Router, Request, Response } from 'express';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const getDirname = () => {
  if (typeof __dirname !== 'undefined') return __dirname;
  return dirname(fileURLToPath(import.meta.url));
};

const modelsText = readFileSync(join(getDirname(), '../templates/models.md'), 'utf-8');
const modelList = modelsText.split('\n').filter(m => m.trim());
const models = modelList.map((id, index) => ({
  id,
  object: 'model',
  created: 1704067200 + index * 86400,
  owned_by: id.includes('gpt') ? 'openai' :
            id.includes('claude') ? 'anthropic' :
            id.includes('gemini') ? 'google' :
            id.includes('deepseek') ? 'deepseek' :
            id.includes('glm') ? 'zhipu' :
            id.includes('kimi') ? 'moonshot' : 'unknown',
}));

const router = Router();

router.get('/v1/models', (_req: Request, res: Response) => {
  res.json({
    object: 'list',
    data: models,
  });
});

export default router;