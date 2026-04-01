import { Router } from 'express';
import supabaseAdmin from '../services/supabase.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

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

// ── GET /api/auth/me ─────────────────────────────────────────────────────────

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const user = { id: req.userId, email: req.userEmail };

    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('profile_data, refine_data, last_cards, last_narrative')
      .eq('user_id', req.userId)
      .maybeSingle();

    if (error) throw error;

    let savedProfile = null;
    if (profile?.profile_data) {
      const inputs = profile.profile_data;

      // Handle legacy blob format: old profile_data stored the entire { inputs, refineInputs, ... }
      if (inputs.inputs) {
        savedProfile = {
          inputs:               inputs.inputs,
          refineInputs:         inputs.refineInputs ?? null,
          lastCards:            inputs.lastCards ?? null,
          lastAdvisorNarrative: inputs.lastAdvisorNarrative ?? null,
        };
      } else {
        savedProfile = {
          inputs,
          refineInputs:         profile.refine_data    ?? null,
          lastCards:            profile.last_cards      ?? null,
          lastAdvisorNarrative: profile.last_narrative  ?? null,
        };
      }
    }

    res.json({ user, savedProfile });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/auth/profile ───────────────────────────────────────────────────

router.post('/profile', requireAuth, async (req, res, next) => {
  try {
    const { inputs, refineInputs, lastCards, lastAdvisorNarrative } = req.body;
    if (!inputs || typeof inputs !== 'object') {
      return res.status(400).json({ error: 'inputs must be an object' });
    }

    const { error } = await supabaseAdmin
      .from('profiles')
      .upsert({
        user_id:        req.userId,
        profile_data:   inputs,
        refine_data:    refineInputs ?? null,
        last_cards:     lastCards ?? null,
        last_narrative: lastAdvisorNarrative ?? null,
        updated_at:     new Date().toISOString(),
      }, { onConflict: 'user_id' });

    if (error) throw error;

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/auth/save-plan ─────────────────────────────────────────────────

router.post('/save-plan', requireAuth, async (req, res, next) => {
  try {
    const { planName, inputs, cards, advisorNarrative } = req.body;
    console.log('[save-plan] userId:', req.userId, '| planName:', planName, '| has inputs:', !!inputs, '| card count:', Array.isArray(cards) ? cards.length : 'not array');

    if (!planName || typeof planName !== 'string') {
      return res.status(400).json({ error: 'planName is required' });
    }
    if (!inputs || !cards) {
      return res.status(400).json({ error: 'inputs and cards are required' });
    }

    const { data, error } = await supabaseAdmin
      .from('saved_plans')
      .insert({
        user_id:          req.userId,
        plan_name:        planName.trim(),
        inputs,
        cards,
        advisor_narrative: advisorNarrative ?? null,
      })
      .select('id')
      .single();

    if (error) throw error;

    res.json({ success: true, planId: data.id });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/auth/saved-plans ────────────────────────────────────────────────

router.get('/saved-plans', requireAuth, async (req, res, next) => {
  try {
    const { data: rows, error } = await supabaseAdmin
      .from('saved_plans')
      .select('id, plan_name, inputs, cards, advisor_narrative, created_at')
      .eq('user_id', req.userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const plans = rows.map((r) => ({
      id:               r.id,
      planName:         r.plan_name,
      inputs:           r.inputs,
      cards:            r.cards,
      advisorNarrative: r.advisor_narrative ?? null,
      createdAt:        r.created_at,
    }));

    res.json({ plans });
  } catch (err) {
    next(err);
  }
});

// ── DELETE /api/auth/saved-plans/:id ────────────────────────────────────────

router.delete('/saved-plans/:id', requireAuth, async (req, res, next) => {
  try {
    const planId = req.params.id;

    const { data, error } = await supabaseAdmin
      .from('saved_plans')
      .delete()
      .eq('id', planId)
      .eq('user_id', req.userId)
      .select('id');

    if (error) throw error;
    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

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

    const shares = purchasePriceResolved ? amount / purchasePriceResolved : null;

    console.log(`[portfolio/add] inserting: ticker=${cleanTicker} amount=${amount} price=${purchasePriceResolved} shares=${shares}`);

    const { data, error } = await supabaseAdmin
      .from('portfolio_holdings')
      .insert({
        user_id:        req.userId,
        ticker:         cleanTicker,
        name:           name ? String(name).slice(0, 200) : null,
        security_type:  securityType || null,
        amount_invested: amount,
        shares,
        purchase_price:  purchasePriceResolved,
        purchase_month:  purchaseMonth ? Number(purchaseMonth) : null,
        purchase_year:   purchaseYear  ? Number(purchaseYear)  : null,
        account_type:    accountType   ? String(accountType)   : null,
        added_from:      addedFrom     ? String(addedFrom)     : 'manual',
      })
      .select('id')
      .single();

    if (error) throw error;

    console.log('[portfolio/add] inserted id:', data.id);
    res.json({ success: true, id: data.id });
  } catch (err) {
    console.error('[portfolio/add] error:', err.message);
    next(err);
  }
});

// ── GET /api/auth/portfolio/holdings ─────────────────────────────────────────

router.get('/portfolio/holdings', requireAuth, async (req, res, next) => {
  try {
    const { data: rows, error } = await supabaseAdmin
      .from('portfolio_holdings')
      .select('id, ticker, name, security_type, amount_invested, shares, purchase_price, purchase_month, purchase_year, account_type, added_from, added_at')
      .eq('user_id', req.userId)
      .order('added_at', { ascending: false });

    if (error) throw error;
    if (rows.length === 0) return res.json({ holdings: [] });

    const uniqueTickers = [...new Set(rows.map((r) => r.ticker))];
    const quoteResults = await Promise.allSettled(uniqueTickers.map(fetchSimpleQuote));
    const priceMap = {};
    quoteResults.forEach((r) => {
      if (r.status === 'fulfilled') priceMap[r.value.ticker] = r.value;
    });

    const holdings = rows.map((r) => {
      console.log('[holding]', r.ticker, 'purchase_price:', r.purchase_price, 'shares:', r.shares, 'amount_invested:', r.amount_invested);
      const q = priceMap[r.ticker] ?? {};
      const currentPrice = q.currentPrice ?? null;

      let currentValue = null;
      let gainLoss = null;
      let gainLossPct = null;
      if (r.purchase_price && r.purchase_price > 0 && currentPrice != null) {
        const computedShares = r.amount_invested / r.purchase_price;
        currentValue = computedShares * currentPrice;
        gainLoss = currentValue - r.amount_invested;
        gainLossPct = (gainLoss / r.amount_invested) * 100;
      }

      const dayChange = currentValue != null && q.dayChangePct != null ? currentValue * (q.dayChangePct / 100) : null;

      return {
        id:            r.id,
        ticker:        r.ticker,
        name:          r.name,
        securityType:  r.security_type,
        amountInvested: r.amount_invested,
        shares:        r.shares,
        purchasePrice: r.purchase_price,
        purchaseMonth: r.purchase_month,
        purchaseYear:  r.purchase_year,
        accountType:   r.account_type,
        addedFrom:     r.added_from,
        addedAt:       r.added_at,
        currentPrice,
        currentValue,
        gainLoss,
        gainLossPct,
        dayChange,
        dayChangePct:  q.dayChangePct ?? null,
      };
    });

    res.json({ holdings });
  } catch (err) {
    next(err);
  }
});

// ── DELETE /api/auth/portfolio/holdings/:id ───────────────────────────────────

router.delete('/portfolio/holdings/:id', requireAuth, async (req, res, next) => {
  try {
    const holdingId = req.params.id;

    const { data, error } = await supabaseAdmin
      .from('portfolio_holdings')
      .delete()
      .eq('id', holdingId)
      .eq('user_id', req.userId)
      .select('id');

    if (error) throw error;
    if (!data || data.length === 0) return res.status(404).json({ error: 'Holding not found' });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ── PATCH /api/auth/portfolio/holdings/:id ────────────────────────────────────

router.patch('/portfolio/holdings/:id', requireAuth, async (req, res, next) => {
  try {
    const holdingId = req.params.id;

    console.log('[PATCH portfolio]', req.body);
    const { amountInvested, purchasePrice, purchaseMonth, purchaseYear, accountType } = req.body;

    const amount = parseFloat(amountInvested);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: 'amountInvested must be a positive number' });
    }

    let purchasePriceResolved = null;
    if (purchasePrice != null && purchasePrice !== '') {
      const parsed = parseFloat(purchasePrice);
      if (Number.isFinite(parsed) && parsed > 0) purchasePriceResolved = parsed;
    }

    const shares = purchasePriceResolved ? amount / purchasePriceResolved : null;

    const { data, error } = await supabaseAdmin
      .from('portfolio_holdings')
      .update({
        amount_invested: amount,
        shares,
        purchase_price:  purchasePriceResolved,
        purchase_month:  purchaseMonth ? Number(purchaseMonth) : null,
        purchase_year:   purchaseYear  ? Number(purchaseYear)  : null,
        account_type:    accountType   ? String(accountType)   : null,
      })
      .eq('id', holdingId)
      .eq('user_id', req.userId)
      .select('id');

    if (error) throw error;
    if (!data || data.length === 0) return res.status(404).json({ error: 'Holding not found' });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/auth/portfolio/quotes ────────────────────────────────────────────

router.get('/portfolio/quotes', requireAuth, async (req, res, next) => {
  try {
    const tickersParam = req.query.tickers ?? '';
    const tickers = tickersParam
      .split(',')
      .map((t) => t.trim().toUpperCase())
      .filter((t) => t && t.length <= 10)
      .slice(0, 20);

    if (tickers.length === 0) return res.json({ quotes: {} });

    const results = await Promise.allSettled(tickers.map(fetchSimpleQuote));
    const quotes = {};
    results.forEach((r) => {
      if (r.status === 'fulfilled') quotes[r.value.ticker] = r.value;
    });

    res.json({ quotes });
  } catch (err) {
    next(err);
  }
});

export default router;
