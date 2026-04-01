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

const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  ...(process.env.CORS_ORIGIN ? [process.env.CORS_ORIGIN] : []),
];
app.use(cors({ origin: allowedOrigins }));
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
