import { Router } from 'express';
import { chatLimiter } from '../middleware/rate-limit.js';
import { bodySizeLimit } from '../middleware/body-size-limit.js';
import { handleChatCompletion } from '../controllers/chat.js';

const router = Router();

router.post('/v1/chat/completions', chatLimiter, bodySizeLimit, handleChatCompletion);

export default router;
