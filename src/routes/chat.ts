import { Router } from 'express';
import { chatLimiter } from '../middleware/rate-limit.js';
import { requireApiKey } from '../middleware/auth.js';

import { handleChatCompletion } from '../controllers/chat.js';
import { wrapAsync } from '../utils/errors.js';
import { validateChat } from '../validates/chat.js';

const router = Router();

router.post('/v1/chat/completions', requireApiKey, chatLimiter, validateChat, wrapAsync(handleChatCompletion));

export default router;
