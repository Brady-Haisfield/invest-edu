import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import suggestionsRouter from './routes/suggestions.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: ['http://localhost:5173', 'http://127.0.0.1:5173'] }));
app.use(express.json());

app.use('/api/suggestions', suggestionsRouter);

app.use((err, req, res, next) => {
  console.error('[Error]', err.message);
  const status = err.statusCode || 500;
  res.status(status).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
