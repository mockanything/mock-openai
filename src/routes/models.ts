import { Router } from 'express';
import { modelsLimiter } from '../middleware/rate-limit.js';
import { handleListModels } from '../controllers/models.js';

const router = Router();

router.get('/v1/models', modelsLimiter, handleListModels);

export default router;
