import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import db from '../services/db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
const BCRYPT_ROUNDS = 10;

function signToken(userId) {
  return jwt.sign({ userId }, process.env.AUTH_SECRET, { expiresIn: '30d' });
}

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

// ── POST /api/auth/register ──────────────────────────────────────────────────

router.post('/register', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Invalid email address' });
    }
    if (typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail);
    if (existing) {
      return res.status(400).json({ error: 'An account with that email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const result = db.prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)').run(normalizedEmail, passwordHash);
    const userId = result.lastInsertRowid;

    res.json({
      token: signToken(userId),
      user: { id: userId, email: normalizedEmail },
    });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/auth/login ─────────────────────────────────────────────────────

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!isValidEmail(email) || typeof password !== 'string') {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = db.prepare('SELECT id, email, password_hash FROM users WHERE email = ?').get(normalizedEmail);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    res.json({
      token: signToken(user.id),
      user: { id: user.id, email: user.email },
    });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/auth/me ─────────────────────────────────────────────────────────

router.get('/me', requireAuth, (req, res, next) => {
  try {
    const user = db.prepare('SELECT id, email, created_at FROM users WHERE id = ?').get(req.userId);
    if (!user) return res.status(401).json({ error: 'User not found' });

    const profile = db.prepare(
      'SELECT profile_data, refine_data, last_cards, last_narrative FROM profiles WHERE user_id = ?'
    ).get(req.userId);

    let savedProfile = null;
    if (profile) {
      // New 4-column format: profile_data holds only core inputs
      if (profile.profile_data) {
        let inputs = null;
        try { inputs = JSON.parse(profile.profile_data); } catch {}

        // Handle legacy: old profile_data stored the entire blob { inputs, refineInputs, ... }
        if (inputs && inputs.inputs) {
          savedProfile = {
            inputs:              inputs.inputs,
            refineInputs:        inputs.refineInputs ?? null,
            lastCards:           inputs.lastCards ?? null,
            lastAdvisorNarrative: inputs.lastAdvisorNarrative ?? null,
          };
        } else {
          savedProfile = {
            inputs,
            refineInputs:        profile.refine_data   ? JSON.parse(profile.refine_data)   : null,
            lastCards:           profile.last_cards     ? JSON.parse(profile.last_cards)     : null,
            lastAdvisorNarrative: profile.last_narrative ?? null,
          };
        }
      }
    }

    res.json({ user, savedProfile });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/auth/profile ───────────────────────────────────────────────────

router.post('/profile', requireAuth, (req, res, next) => {
  try {
    const { inputs, refineInputs, lastCards, lastAdvisorNarrative } = req.body;
    if (!inputs || typeof inputs !== 'object') {
      return res.status(400).json({ error: 'inputs must be an object' });
    }

    db.prepare(`
      INSERT INTO profiles (user_id, profile_data, refine_data, last_cards, last_narrative, updated_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT (user_id) DO UPDATE SET
        profile_data   = excluded.profile_data,
        refine_data    = excluded.refine_data,
        last_cards     = excluded.last_cards,
        last_narrative = excluded.last_narrative,
        updated_at     = CURRENT_TIMESTAMP
    `).run(
      req.userId,
      JSON.stringify(inputs),
      refineInputs ? JSON.stringify(refineInputs) : null,
      lastCards    ? JSON.stringify(lastCards)    : null,
      lastAdvisorNarrative ?? null,
    );

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/auth/save-plan ─────────────────────────────────────────────────

router.post('/save-plan', requireAuth, (req, res, next) => {
  try {
    const { planName, inputs, cards, advisorNarrative } = req.body;
    console.log('[save-plan] userId:', req.userId, '| planName:', planName, '| has inputs:', !!inputs, '| card count:', Array.isArray(cards) ? cards.length : 'not array');
    if (!planName || typeof planName !== 'string') {
      return res.status(400).json({ error: 'planName is required' });
    }
    if (!inputs || !cards) {
      return res.status(400).json({ error: 'inputs and cards are required' });
    }

    const result = db.prepare(`
      INSERT INTO saved_plans (user_id, plan_name, inputs, cards, advisor_narrative)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      req.userId,
      planName.trim(),
      JSON.stringify(inputs),
      JSON.stringify(cards),
      advisorNarrative ?? null,
    );

    res.json({ success: true, planId: result.lastInsertRowid });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/auth/saved-plans ────────────────────────────────────────────────

router.get('/saved-plans', requireAuth, (req, res, next) => {
  try {
    const rows = db.prepare(`
      SELECT id, plan_name, inputs, cards, advisor_narrative, created_at
      FROM saved_plans
      WHERE user_id = ?
      ORDER BY created_at DESC
    `).all(req.userId);

    const plans = rows.map((r) => ({
      id:               r.id,
      planName:         r.plan_name,
      inputs:           JSON.parse(r.inputs),
      cards:            JSON.parse(r.cards),
      advisorNarrative: r.advisor_narrative ?? null,
      createdAt:        r.created_at,
    }));

    res.json({ plans });
  } catch (err) {
    next(err);
  }
});

// ── DELETE /api/auth/saved-plans/:id ────────────────────────────────────────

router.delete('/saved-plans/:id', requireAuth, (req, res, next) => {
  try {
    const planId = Number(req.params.id);
    if (!Number.isFinite(planId)) {
      return res.status(400).json({ error: 'Invalid plan id' });
    }

    const result = db.prepare(`
      DELETE FROM saved_plans WHERE id = ? AND user_id = ?
    `).run(planId, req.userId);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ── Portfolio helpers ────────────────────────────────────────────────────────

async function fetchSimpleQuote(ticker) {
  try {
    const key = process.env.FINNHUB_API_KEY;
    if (!key) {
      console.warn('[fetchSimpleQuote] FINNHUB_API_KEY not set — skipping price fetch');
      return { ticker, currentPrice: null, dayChangePct: null };
    }
    const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(ticker)}&token=${key}`;
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`[fetchSimpleQuote] Finnhub returned ${res.status} for ${ticker}`);
      return { ticker, currentPrice: null, dayChangePct: null };
    }
    const data = await res.json();
    return { ticker, currentPrice: data.c || null, dayChangePct: data.dp ?? null };
  } catch (err) {
    console.warn(`[fetchSimpleQuote] failed for ${ticker}:`, err.message);
    return { ticker, currentPrice: null, dayChangePct: null };
  }
}

// ── POST /api/auth/portfolio/add ─────────────────────────────────────────────

router.post('/portfolio/add', requireAuth, async (req, res, next) => {
  try {
    console.log('Portfolio add received:', req.body);

    const { ticker, name, securityType, amountInvested, purchasePrice, purchaseMonth, purchaseYear, accountType, addedFrom } = req.body;

    if (!ticker || typeof ticker !== 'string') return res.status(400).json({ error: 'ticker is required' });
    const cleanTicker = ticker.trim().toUpperCase();
    if (!cleanTicker || cleanTicker.length > 10) return res.status(400).json({ error: 'Invalid ticker' });

    const amount = parseFloat(amountInvested);
    if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: 'amountInvested must be a positive number' });

    let purchasePriceResolved = null;
    if (purchasePrice != null && purchasePrice !== '') {
      const parsed = parseFloat(purchasePrice);
      if (Number.isFinite(parsed) && parsed > 0) purchasePriceResolved = parsed;
    }

    // Fetch current Finnhub price as cost basis only if no purchase price provided.
    // This is best-effort — failure here must never block the insert.
    if (!purchasePriceResolved) {
      const q = await fetchSimpleQuote(cleanTicker);
      console.log(`[portfolio/add] Finnhub quote for ${cleanTicker}:`, q);
      if (q.currentPrice) purchasePriceResolved = q.currentPrice;
    }

    const shares = purchasePriceResolved ? amount / purchasePriceResolved : null;

    console.log(`[portfolio/add] inserting: ticker=${cleanTicker} amount=${amount} price=${purchasePriceResolved} shares=${shares}`);

    const result = db.prepare(`
      INSERT INTO portfolio_holdings
        (user_id, ticker, name, security_type, amount_invested, shares, purchase_price, purchase_month, purchase_year, account_type, added_from)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      req.userId,
      cleanTicker,
      name ? String(name).slice(0, 200) : null,
      securityType || null,
      amount,
      shares,
      purchasePriceResolved,
      purchaseMonth ? Number(purchaseMonth) : null,
      purchaseYear ? Number(purchaseYear) : null,
      accountType ? String(accountType) : null,
      addedFrom ? String(addedFrom) : 'manual',
    );

    console.log('[portfolio/add] inserted id:', result.lastInsertRowid);
    res.json({ success: true, id: result.lastInsertRowid });
  } catch (err) {
    console.error('[portfolio/add] error:', err.message, err.stack);
    next(err);
  }
});

// ── GET /api/auth/portfolio/holdings ─────────────────────────────────────────

router.get('/portfolio/holdings', requireAuth, async (req, res, next) => {
  try {
    const rows = db.prepare(`
      SELECT id, ticker, name, security_type, amount_invested, shares, purchase_price,
             purchase_month, purchase_year, account_type, added_from, added_at
      FROM portfolio_holdings WHERE user_id = ?
      ORDER BY added_at DESC
    `).all(req.userId);

    if (rows.length === 0) return res.json({ holdings: [] });

    const uniqueTickers = [...new Set(rows.map((r) => r.ticker))];
    const quoteResults = await Promise.allSettled(uniqueTickers.map(fetchSimpleQuote));
    const priceMap = {};
    quoteResults.forEach((r) => {
      if (r.status === 'fulfilled') priceMap[r.value.ticker] = r.value;
    });

    const holdings = rows.map((r) => {
      const q = priceMap[r.ticker] ?? {};
      const currentPrice = q.currentPrice ?? null;
      const currentValue = (r.shares != null && currentPrice != null) ? r.shares * currentPrice : null;
      const gainLoss = currentValue != null ? currentValue - r.amount_invested : null;
      const gainLossPct = gainLoss != null && r.amount_invested > 0 ? (gainLoss / r.amount_invested) * 100 : null;
      const dayChange = currentValue != null && q.dayChangePct != null ? currentValue * (q.dayChangePct / 100) : null;

      return {
        id: r.id,
        ticker: r.ticker,
        name: r.name,
        securityType: r.security_type,
        amountInvested: r.amount_invested,
        shares: r.shares,
        purchasePrice: r.purchase_price,
        purchaseMonth: r.purchase_month,
        purchaseYear: r.purchase_year,
        accountType: r.account_type,
        addedFrom: r.added_from,
        addedAt: r.added_at,
        currentPrice,
        currentValue,
        gainLoss,
        gainLossPct,
        dayChange,
        dayChangePct: q.dayChangePct ?? null,
      };
    });

    res.json({ holdings });
  } catch (err) {
    next(err);
  }
});

// ── DELETE /api/auth/portfolio/holdings/:id ───────────────────────────────────

router.delete('/portfolio/holdings/:id', requireAuth, (req, res, next) => {
  try {
    const holdingId = Number(req.params.id);
    if (!Number.isFinite(holdingId)) return res.status(400).json({ error: 'Invalid id' });

    const result = db.prepare('DELETE FROM portfolio_holdings WHERE id = ? AND user_id = ?').run(holdingId, req.userId);
    if (result.changes === 0) return res.status(404).json({ error: 'Holding not found' });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
