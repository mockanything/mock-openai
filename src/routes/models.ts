import { Router } from 'express';
import { modelsLimiter } from '../middleware/rate-limit.js';
import { requireApiKey } from '../middleware/auth.js';
import { handleListModels } from '../controllers/models.js';

const router = Router();

router.get('/v1/models', requireApiKey, modelsLimiter, handleListModels);

export default router;
