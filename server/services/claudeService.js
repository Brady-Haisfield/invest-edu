import Anthropic from '@anthropic-ai/sdk';

let client;
function getClient() {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

const SYSTEM_PROMPT = `
You are a financial education assistant. Your role is to help users learn about investing concepts
by suggesting example stocks, ETFs, bond ETFs, and REITs that illustrate principles relevant to
their stated risk tolerance, investment horizon, and interests. You are NOT providing financial
advice. All suggestions are purely educational and for learning purposes only.

When given a user's investing profile, respond with ONLY a valid JSON object — no markdown fences,
no commentary, no extra keys. The object must have exactly this shape:
{
  "advisorNarrative": "4-6 sentences written in first person as a plain-English financial advisor speaking directly to this investor. Reference at least 3 specific facts from their profile (age, family situation, upcoming expenses, income, goal mode, drop reaction, etc). Explain the overall strategy behind the suggestions — why this mix of securities makes sense for their specific situation. Do not use jargon. Do not give specific buy/sell instructions. Frame everything as educational context. End with one honest caveat relevant to their profile.",
  "suggestions": [
    {
      "ticker": "AAPL",
      "type": "stock",
      "reasoning": "Exactly 2 sentences. Sentence 1: what the company/fund does in plain English (no jargon). Sentence 2: why it fits this investor's profile specifically — reference their risk tolerance, hold period, or sector interest.",
      "portfolioRole": "core growth holding",
      "retirementLens": {
        "incomeRole": "Low",
        "volatility": "Medium",
        "liquidity": "High",
        "complexity": "Low",
        "retirementFit": "One plain sentence about how this fits a retirement-stage investor."
      },
      "watchOut": "One sentence under 20 words about the biggest risk for a retirement-stage investor."
    }
  ]
}

Field rules:
- type must be exactly one of: "stock" | "etf" | "bond_etf" | "reit"
- portfolioRole must be exactly one of: "core growth holding" | "income-oriented holding" | "defensive sector exposure" | "inflation-sensitive exposure" | "capital-preservation option" | "real estate income exposure" | "broad market exposure"
- retirementLens.incomeRole, volatility, liquidity, complexity must each be exactly "Low", "Medium", or "High"
- retirementLens.retirementFit must be one plain sentence
- watchOut must be one sentence under 20 words

General rules:
- Use only real, currently-listed US tickers on NYSE or NASDAQ (stocks, ETFs, bond ETFs, or REITs).
- Do not suggest penny stocks or OTC-only securities.
- Vary suggestions across different sectors unless the user specifies otherwise.
- Tailor complexity of reasoning to the risk profile:
  low = stable blue-chips, dividend ETFs, bond ETFs, or REITs with simple income/stability explanations
  medium = balanced mix of growth stocks, broad market ETFs, and income options
  high = growth/speculative stocks with explanations of why higher volatility fits their horizon
- If the risk profile is low OR the hold period is short, include at least 2 ETFs, bond ETFs, or REITs.
- reasoning must be exactly 2 sentences. No more. No exceptions.

Account type awareness:
- If account type is "Taxable brokerage": avoid bond ETFs (tax-inefficient in taxable accounts) and prefer ETFs with low turnover and qualified dividends.
- If account type is "Roth IRA" or "Traditional IRA": bond ETFs and high-dividend stocks are ideal here since taxes are deferred or eliminated.
- If account type is "401(k) / employer plan": suggest broad, low-cost index funds and target-date style allocations.
- Always mention the account type briefly in the reasoning when it meaningfully affects the suggestion.
`.trim();

const GOAL_MODE_INSTRUCTIONS = {
  'just-starting':          'Investor is just getting started — prefer broad market ETFs, simple blue-chip stocks, and low-complexity options. Avoid niche or speculative picks.',
  'growing-wealth':         'Investor is in wealth-building mode — prefer equities and growth-oriented ETFs with solid fundamentals. Some diversification is welcome.',
  'approaching-retirement': 'Investor is approaching retirement — bias strongly toward income, stability, bond ETFs, dividend stocks, and REITs. Limit high-volatility picks.',
  'already-retired':        'Investor is already retired — prioritize capital preservation and income. Bonds, dividend ETFs, and REITs are ideal. Avoid growth stocks and speculative assets.',
};

function buildUserPrompt(inputs) {
  const retirementNote = (inputs.riskProfile === 'low' || inputs.holdPeriod === 'short')
    ? 'Note: This investor prefers lower risk or a shorter horizon — lean toward capital preservation. Include at least 2 ETFs, bond ETFs, or REITs.'
    : '';
  const goalNote = GOAL_MODE_INSTRUCTIONS[inputs.goalMode] || '';

  // Build comprehensive profile lines — omit empty optional fields
  const lines = [];
  if (inputs.age)              lines.push(`Age: ${inputs.age}`);
  lines.push(`Risk tolerance: ${inputs.riskProfile}`);
  lines.push(`Goal mode: ${inputs.goalMode}`);
  if (inputs.annualIncome)     lines.push(`Annual income: ${inputs.annualIncome}`);
  if (inputs.accountType)      lines.push(`Account type: ${inputs.accountType}`);
  if (inputs.employmentStatus) lines.push(`Employment: ${inputs.employmentStatus}`);
  if (inputs.emergencyFund)    lines.push(`Emergency fund: ${inputs.emergencyFund}`);
  if (inputs.existingInvestments?.length) lines.push(`Existing investments: ${inputs.existingInvestments.join(', ')}`);
  if (inputs.familySituation)  lines.push(`Family situation: ${inputs.familySituation}`);
  if (inputs.homeownership)    lines.push(`Homeownership: ${inputs.homeownership}`);
  if (inputs.upcomingExpenses?.length) lines.push(`Upcoming expenses: ${inputs.upcomingExpenses.join(', ')}`);
  if (inputs.priorities?.length) lines.push(`Priorities: ${inputs.priorities.join(', ')}`);
  if (inputs.dropReaction)     lines.push(`Reaction to 20% portfolio drop: ${inputs.dropReaction}`);
  if (inputs.themes?.length)   lines.push(`Themes of interest: ${inputs.themes.join(', ')}`);
  if (inputs.involvement)      lines.push(`Involvement preference: ${inputs.involvement}`);
  if (inputs.investmentPurpose) lines.push(`Investment purpose: ${inputs.investmentPurpose}`);
  lines.push(`Amount to invest: $${inputs.amount.toLocaleString()}`);
  lines.push(`Hold period: ${inputs.holdPeriod}-term`);
  if (inputs.sectors?.length)  lines.push(`Sectors of interest: ${inputs.sectors.join(', ')}`);

  const profile = lines.map((l) => `- ${l}`).join('\n');

  return `
Investor profile:
${profile}

Goal mode guidance: ${goalNote}
${retirementNote ? retirementNote + '\n' : ''}
Use ALL of the above profile details to personalize every suggestion. Reference specific profile facts in the reasoning field — for example mention the college tuition timeline, the income bracket, the drop reaction, or the family situation where relevant.

Suggest 5 educational investment examples for this profile. Respond with JSON array only.
`.trim();
}

const FORECAST_SYSTEM_PROMPT = `
You are a financial education assistant. You help beginners understand how stocks work. You write like you are talking to a 22-year-old who has never invested before.

Language rules you must follow:
- Never use financial jargon without defining it in the same sentence. For example, instead of "multiple compression risk" say "investors might decide the stock isn't worth paying as much for, which would push the price down." Instead of "DCF yields $294" say "based on the cash the company is expected to bring in over the next 5 years, a fair price would be around $294."
- Keep every sentence under 20 words.
- Keep every paragraph under 3 sentences.
- Use plain, everyday words. No Wall Street language.
- Each bullet (driver or risk explanation) must be exactly one sentence. Maximum 20 words per bullet. If a bullet runs longer than one sentence, split it or drop the extra detail. No bullet should ever be two sentences.

You must respond with ONLY a valid JSON object — no markdown fences, no commentary.
The object must have exactly this shape:
{
  "keyMetrics": [
    { "label": "P/E Ratio (how much investors pay per $1 of profit)", "value": "24.5x" }
  ],
  "verdict": {
    "summary": "Exactly 3 sentences: what the company does, what the data shows right now, and which direction has stronger evidence. Use plain language.",
    "lean": "bullish"
  },
  "bull": {
    "headline": "One plain sentence — the best reason to be optimistic about this stock.",
    "drivers": [
      { "explanation": "One sentence referencing a specific data point. Define any terms used." }
    ],
    "priceTargetRange": { "low": 180, "high": 220 }
  },
  "bear": {
    "headline": "One plain sentence — the biggest reason to be cautious about this stock.",
    "risks": [
      { "explanation": "One sentence referencing a specific data point. Define any terms used." }
    ],
    "downsideScenario": { "low": 90, "high": 120 }
  },
  "educationalNote": "2-3 sentences explaining what investing concept this analysis illustrates. Keep it simple and beginner-friendly.",
  "confidenceScore": 72,
  "historicalScenarios": [
    {
      "year": 2018,
      "situation": "One sentence — what was happening with this stock and the market then.",
      "similarity": "One sentence — why that period looks like today.",
      "outcome": "+34% over 12 months",
      "lesson": "One sentence — what a beginner investor can learn from this."
    }
  ]
}

Rules:
- verdict.lean must be exactly one of: "bullish", "neutral", "bearish"
- Set confidenceScore between 0-100. Base it on how clearly the data points in one direction. Strong earnings beats + healthy margins + reasonable valuation = high confidence (75+). Mixed signals or stalled growth with high valuation = low confidence (40-55). Return it as a top-level field in the JSON.
- Price targets are illustrative only — present them as a rough range, not a prediction.
- Use only the data provided — do not invent metrics not in the input.
- Include 4-5 keyMetrics. For each label, add a short plain-English definition in parentheses.
- Include exactly 3 bull drivers and 3 bear risks, each a single sentence.
- If certain data is missing, say so briefly and reason from what is available.
- Every explanation must reference a specific data point from the input.
- Find 2-3 real historical periods where this specific stock faced similar conditions to today — similar valuation level, similar growth rate, similar market environment. Use your training knowledge of the stock's actual history. Be specific about years and real numbers. Write everything in plain English under 20 words per field.
`.trim();

function buildForecastUserPrompt(stockData) {
  const { ticker, profile, quote, metrics, annualFinancials, earnings, recentNews } = stockData;

  const newsLines = recentNews.length
    ? recentNews.map((h) => `- ${h}`).join('\n')
    : '- No recent news available';

  return `
Analyze the following stock data for ${ticker} (${profile.name}) and generate an educational Bear/Bull forecast.

=== COMPANY PROFILE ===
Sector/Industry: ${profile.sector ?? 'Unknown'}
Market Cap: ${profile.marketCap ? `$${profile.marketCap.toLocaleString()}M` : 'N/A'}
IPO: ${profile.ipo ?? 'N/A'}
Exchange: ${profile.exchange ?? 'N/A'}

=== CURRENT PRICE ===
Price: $${quote.price}
Previous Close: ${quote.prevClose != null ? `$${quote.prevClose}` : 'N/A'}
Change Today: ${quote.changePercent != null ? `${quote.changePercent}%` : 'N/A'}
52-Week High: ${quote.high52 != null ? `$${quote.high52}` : 'N/A'}
52-Week Low: ${quote.low52 != null ? `$${quote.low52}` : 'N/A'}

=== KEY FINANCIAL METRICS ===
${Object.keys(metrics).length ? JSON.stringify(metrics, null, 2) : 'Limited metrics available on free data tier.'}

=== ANNUAL FINANCIALS (last 3 years) ===
${annualFinancials.length ? JSON.stringify(annualFinancials, null, 2) : 'No reported financials available.'}

=== EARNINGS SURPRISES (last 4 quarters) ===
${earnings.length ? JSON.stringify(earnings, null, 2) : 'No earnings history available.'}

=== RECENT NEWS HEADLINES ===
${newsLines}

PRICE TARGET CONSTRAINT:
Current price is $${quote.price}.
bull.priceTargetRange.low AND .high must BOTH be above $${quote.price}.
bear.downsideScenario.low AND .high must BOTH be below $${quote.price}.
The current price is always the baseline — never set targets that cross it.

Respond with the JSON forecast object only.
`.trim();
}

export async function getForecast(stockData) {
  const message = await getClient().messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: FORECAST_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildForecastUserPrompt(stockData) }],
  });

  const raw = message.content[0].text.trim();
  const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const err = new Error('AI response was not valid JSON. Please try again.');
    err.statusCode = 502;
    throw err;
  }

  if (!parsed.bull || !parsed.bear || !parsed.verdict || !parsed.keyMetrics) {
    const err = new Error('AI returned an unexpected format. Please try again.');
    err.statusCode = 502;
    throw err;
  }

  const price = stockData.quote.price;
  if (
    parsed.bull?.priceTargetRange?.low <= price ||
    parsed.bull?.priceTargetRange?.high <= price ||
    parsed.bear?.downsideScenario?.low >= price ||
    parsed.bear?.downsideScenario?.high >= price
  ) {
    const err = new Error('AI returned invalid price targets. Please try again.');
    err.statusCode = 502;
    throw err;
  }

  return parsed;
}

export async function getSuggestions(inputs) {
  const message = await getClient().messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildUserPrompt(inputs) }],
  });

  const raw = message.content[0].text.trim();

  // Strip markdown fences if present
  const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const err = new Error('AI response was not valid JSON. Please try again.');
    err.statusCode = 502;
    throw err;
  }

  if (!parsed.suggestions || !Array.isArray(parsed.suggestions) || parsed.suggestions.length === 0) {
    const err = new Error('AI returned an unexpected format. Please try again.');
    err.statusCode = 502;
    throw err;
  }

  const advisorNarrative = typeof parsed.advisorNarrative === 'string' ? parsed.advisorNarrative.trim() : '';

  // Validate and filter to well-formed suggestions
  const TICKER_RE = /^[A-Z]{1,5}$/;
  const suggestions = parsed.suggestions
    .filter(
      (s) =>
        s &&
        typeof s.ticker === 'string' &&
        TICKER_RE.test(s.ticker) &&
        typeof s.reasoning === 'string' &&
        s.reasoning.length > 0
    )
    .map((s) => ({
      ticker: s.ticker,
      type: s.type || 'stock',
      reasoning: s.reasoning,
      portfolioRole: s.portfolioRole || null,
      retirementLens: s.retirementLens || null,
      watchOut: s.watchOut || null,
    }));

  return { advisorNarrative, suggestions };
}
