import { Router } from 'express';
import { handleEmbedding } from '../controllers/embeddings.js';

const router = Router();

router.post('/v1/embeddings', handleEmbedding);

export default router;
