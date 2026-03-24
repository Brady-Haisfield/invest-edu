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
