import { Router } from 'express';
import { handleEmbedding } from '../controllers/embeddings.js';
import { wrapAsync } from '../utils/errors.js';

const router = Router();

router.post('/v1/embeddings', wrapAsync(handleEmbedding));

export default router;
