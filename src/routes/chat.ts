import { Router } from 'express';
import { chatLimiter } from '../middleware/rate-limit.js';
import { bodySizeLimit } from '../middleware/body-size-limit.js';
import { handleChatCompletion } from '../controllers/chat.js';
import { wrapAsync } from '../utils/errors.js';
import { validateChat } from '../validates/chat.js';

const router = Router();

router.post('/v1/chat/completions', chatLimiter, bodySizeLimit, validateChat, wrapAsync(handleChatCompletion));

export default router;
