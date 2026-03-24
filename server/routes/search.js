import { Router } from 'express';

const router = Router();
const BASE = 'https://finnhub.io/api/v1';

router.get('/', async (req, res, next) => {
  try {
    const q = req.query.q;
    if (!q || typeof q !== 'string' || q.trim().length < 1) {
      return res.json({ result: [] });
    }
    const key = process.env.FINNHUB_API_KEY;
    const data = await fetch(`${BASE}/search?q=${encodeURIComponent(q.trim())}&token=${key}`)
      .then((r) => r.json());
    // Filter to common stock only, limit to 8
    const results = (data.result ?? [])
      .filter((r) => r.type === 'Common Stock')
      .slice(0, 8)
      .map((r) => ({ ticker: r.symbol, name: r.description }));
    res.json({ results });
  } catch (err) {
    next(err);
  }
});

export default router;
