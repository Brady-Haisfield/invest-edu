import Anthropic from '@anthropic-ai/sdk';

let client;
function getClient() {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

const SYSTEM_PROMPT = `
You are a financial education assistant. Your role is to help users learn about investing concepts
by suggesting example stocks that illustrate principles relevant to their stated risk tolerance,
investment horizon, and interests. You are NOT providing financial advice. All suggestions are
purely educational and for learning purposes only.

When given a user's investing profile, respond with ONLY a valid JSON array — no markdown fences,
no commentary, no extra keys. The array must contain exactly 5 objects with this shape:
[
  {
    "ticker": "AAPL",
    "reasoning": "A 2-3 sentence educational explanation of why this stock illustrates concepts relevant to the user's profile. Mention the sector, what the company does, and what investing concept it demonstrates (e.g. dividend stability, growth potential, defensive characteristics, etc.)."
  }
]

Rules:
- Use only real, currently-listed US stock tickers on NYSE or NASDAQ.
- Do not suggest penny stocks, OTC-only securities, or ETFs.
- Vary suggestions across different sectors unless the user specifies otherwise.
- Tailor complexity of reasoning to the risk profile:
  low = stable blue-chips with simple dividend/stability explanations
  medium = balanced mix of growth and stability
  high = growth/speculative stocks with explanations of why higher volatility fits their horizon
`.trim();

function buildUserPrompt(inputs) {
  return `
User investing profile:
- Risk tolerance: ${inputs.riskProfile}
- Amount to invest: $${inputs.amount.toLocaleString()}
- Hold period: ${inputs.holdPeriod}-term
- Sectors of interest: ${inputs.sectors.length ? inputs.sectors.join(', ') : 'No preference'}

Suggest 5 educational stock examples for this profile. Respond with JSON array only.
`.trim();
}

const FORECAST_SYSTEM_PROMPT = `
You are a financial education assistant that helps users understand how professional analysts
think about stocks. You analyze real market data and explain Bear Case and Bull Case scenarios
in plain language — teaching investing concepts, not giving advice.

You must respond with ONLY a valid JSON object — no markdown fences, no commentary.
The object must have exactly this shape:
{
  "keyMetrics": [
    { "label": "P/E Ratio", "value": "24.5x" }
  ],
  "verdict": {
    "summary": "Exactly 3 sentences: what the company does, what the data shows right now, and which direction has stronger evidence.",
    "lean": "bullish"
  },
  "bull": {
    "headline": "One punchy sentence summarizing the bull thesis.",
    "drivers": [
      { "explanation": "One sentence referencing a specific data point." }
    ],
    "priceTargetRange": { "low": 180, "high": 220 }
  },
  "bear": {
    "headline": "One punchy sentence summarizing the bear thesis.",
    "risks": [
      { "explanation": "One sentence referencing a specific data point." }
    ],
    "downsideScenario": { "low": 90, "high": 120 }
  },
  "educationalNote": "2-3 sentences explaining what investing concept this analysis illustrates."
}

Rules:
- verdict.lean must be exactly one of: "bullish", "neutral", "bearish"
- Price targets are speculative illustrations only — no methodology explanation needed.
- Use only the data provided — do not hallucinate metrics not in the input.
- Keep language accessible to someone learning to invest.
- Include 4-5 keyMetrics (just label and value, no context text).
- Include exactly 3 bull drivers and 3 bear risks, each a single sentence.
- If certain data is missing, note this briefly and lean on qualitative reasoning.
- Every explanation must reference a specific data point from the input.
`.trim();

function buildForecastUserPrompt(stockData) {
  const { ticker, profile, quote, metrics, annualFinancials, earnings, monthlyCloses, recentNews } = stockData;

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

=== MONTHLY PRICE HISTORY (closing prices, most recent 24 months) ===
${monthlyCloses.length ? JSON.stringify(monthlyCloses) : 'No price history available.'}

=== RECENT NEWS HEADLINES ===
${newsLines}

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

  return parsed;
}

export async function getSuggestions(inputs) {
  const message = await getClient().messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
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

  if (!Array.isArray(parsed) || parsed.length === 0) {
    const err = new Error('AI returned an unexpected format. Please try again.');
    err.statusCode = 502;
    throw err;
  }

  // Validate and filter to well-formed suggestions
  const TICKER_RE = /^[A-Z]{1,5}$/;
  return parsed.filter(
    (s) =>
      s &&
      typeof s.ticker === 'string' &&
      TICKER_RE.test(s.ticker) &&
      typeof s.reasoning === 'string' &&
      s.reasoning.length > 0
  );
}
