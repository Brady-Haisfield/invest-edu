import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import suggestionsRouter from './routes/suggestions.js';
import forecastRouter from './routes/forecast.js';
import searchRouter from './routes/search.js';
import authRouter from './routes/auth.js';
import marketRatesRouter from './routes/marketRates.js';
import { requireAuth } from './middleware/auth.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin(origin, callback) {
    if (
      !origin ||
      origin === 'http://localhost:5173' ||
      origin === 'https://meridian-iota-seven.vercel.app' ||
      /^https:\/\/[^.]+\.vercel\.app$/.test(origin)
    ) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
}));
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use('/api/suggestions', requireAuth, suggestionsRouter);
app.use('/api/forecast', requireAuth, forecastRouter);
app.use('/api/search', searchRouter);
app.use('/api/auth', authRouter);
app.use('/api/market-rates', marketRatesRouter);

app.use((err, req, res, next) => {
  console.error('[Error]', err.message);
  const status = err.statusCode || 500;
  res.status(status).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
