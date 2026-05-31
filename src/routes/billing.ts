import { Router } from 'express';
import { handleBillingQuery } from '../controllers/billing.js';

const router = Router();

router.get('/v1/billing', handleBillingQuery);

export default router;
