import { Router } from 'express';
import { requireApiKey } from '../middleware/auth.js';
import { handleBillingQuery } from '../controllers/billing.js';

const router = Router();

router.get('/v1/billing', requireApiKey, handleBillingQuery);

export default router;
