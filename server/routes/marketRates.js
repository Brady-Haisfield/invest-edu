import { Router } from 'express';
import { getTreasuryRates } from '../services/fredService.js';

const router = Router();

// Lightweight endpoint — returns FRED market rates without triggering a full suggestions fetch.
// Used by the client when restoring cards from DB (no fresh suggestions needed, but we still
// want live treasury rates for the SPY comparison and bond ETF projections).
router.get('/', async (req, res, next) => {
  try {
    const rates = await getTreasuryRates();
    res.json({ marketRates: rates });
  } catch (err) {
    next(err);
  }
});

export default router;
