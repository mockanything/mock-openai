import { Router } from 'express';
import { handleEmbedding } from '../controllers/embeddings.js';
import { wrapAsync } from '../utils/errors.js';
import { validateEmbedding } from '../validates/embeddings.js';

const router = Router();

router.post('/v1/embeddings', validateEmbedding, wrapAsync(handleEmbedding));

export default router;
