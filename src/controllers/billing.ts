import { Request, Response } from 'express';
import { queryBilling } from '../services/billing.js';
import { extractApiKey } from '../utils/helpers.js';

export function handleBillingQuery(req: Request, res: Response): void {
  const apiKey = (req.query.api_key as string) || extractApiKey(req);
  const startDate = req.query.start_date as string | undefined;
  const endDate = req.query.end_date as string | undefined;

  const result = queryBilling(apiKey, startDate, endDate);
  res.json(result);
}
