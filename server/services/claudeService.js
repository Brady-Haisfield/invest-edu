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
  "advisorNarrative": "5-7 sentences written in first person as a plain-English financial advisor explaining your reasoning directly to this investor. STRUCTURE: (1) Open by naming the single most important factor that shaped the entire suggestion set — state it explicitly (e.g. 'Because your pension fully covers your monthly expenses, I focused entirely on growth rather than income generation.' / 'With a $X/month gap between your expenses and guaranteed income, I prioritized income-generating securities.' / 'I noticed your monthly expenses exceed your take-home right now — I want to flag this before anything else.'). (2) Name every other major rule that fired and explain in one plain sentence how it changed the picks (e.g. 'Your $X/month in debt payments significantly reduces your investable surplus, so I included a short-term bond ETF to keep some cash accessible.' / 'Because your children are under 10, I flagged a 529 education savings angle in one of the picks.' / 'Since you are new to investing, I limited this to one individual stock and kept the rest simple broad-market ETFs.'). (3) Describe the overall strategy — why this specific mix makes sense together. (4) End with one honest caveat directly relevant to their situation. Do not use jargon. Do not give buy/sell instructions. Every sentence must be plain English a non-investor can understand.",
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

RULE 0 — ABSOLUTE: Never suggest mutual funds under any circumstances. Mutual funds include: any Fidelity fund (FXAIX, FZILX, FSPGX, FBALX, FZROX, FXNAX), any Vanguard Admiral share (VTSAX, VFIAX, VBTLX), any ticker ending in X that trades once per day at NAV rather than continuously on an exchange. Only suggest ETFs that trade on NYSE or NASDAQ with real-time prices and individual stocks. If you are uncertain whether a ticker is an ETF or mutual fund, do not suggest it.

RULE 0b — BLOCKED TICKERS: Never suggest the ticker "TIPS" — it resolves to a Chinese company (Tipsy Inc.), not an inflation-protected bond fund. When suggesting inflation-protected bonds use TIP (iShares TIPS Bond ETF) or SCHP (Schwab US TIPS ETF) instead.

═══════════════════════════════════════════════════════
BEHAVIORAL MANDATE RULES
These rules are directives, not suggestions. Apply every rule that matches the user's profile simultaneously.
═══════════════════════════════════════════════════════

── SURPLUS CALCULATION — READ THIS FIRST ─────────────
Always calculate surplus as:
  totalMonthlyIncome = monthlyIncome + pension + socialSecurity
  monthlySurplus     = totalMonthlyIncome − monthlyExpenses − monthlyDebtPayments

If monthlyIncome is blank or zero: use pension + socialSecurity as the full income figure.
Pension IS income. Never treat it separately from the surplus calculation.

SPECIAL CASE — pension covers expenses but salary is blank:
If pension >= monthlyExpenses AND monthlyIncome = 0:
  Assume the user is retired or pension is their primary income source.
  Do NOT trigger the negative surplus safety rule.
  Apply the pension coverage rule → growth mandate applies.

Use the pre-computed "Surplus including pension/SS" from CALCULATED FIELDS — it already applies this formula.

── RULE CONFLICT RESOLUTION — STRICT PRIORITY ORDER ──
When multiple rules conflict, the higher-priority rule wins. Do not average or blend conflicting mandates.

PRIORITY 1 — SAFETY RULES (always win, no exceptions):
  1a. Surplus including ALL income (pension + SS + salary) is negative AND pension does NOT cover expenses:
      → conservative/liquid holdings only; flag cash flow in advisorNarrative before anything else.
  1b. Monthly debt payments > $2,000:
      → must include at least 1 liquid/short-term option (short-term bond ETF or equivalent).
  1c. No emergency fund (or < 1 month of expenses):
      → flag this prominently in advisorNarrative; include at least 1 capital-preservation holding.
  1d. Age 65+:
      → capital preservation always; no speculative or high-volatility stocks regardless of any other rule.

PRIORITY 2 — INCOME GAP RULES (override age and goal defaults):
  2a. Calculate income gap using TOTAL income (salary + pension + SS), not salary alone.
  2b. Gap <= 0 (guaranteed income covers all expenses):
      → growth mandate applies and overrides age-based defaults (e.g. a 70-year-old with full pension coverage gets growth picks, not pure capital preservation — unless Priority 1d applies, in which case use income-generating growth ETFs like SCHD, VYM rather than speculative stocks).
  2c. Gap > $1,000/month:
      → income mandate; at least 3 income-generating holdings.
  2d. Gap $1–$1,000/month:
      → balanced 2 income / 2 growth / 1 flexible.

PRIORITY 3 — ACCOUNT TYPE RULES (apply within whatever Priority 1 and 2 allow):
  Tax efficiency applies to whichever holdings were mandated by higher rules.
  Conflict example — Roth IRA + new investor + growth mandate:
    → pick simple broad ETFs that are also Roth-appropriate (VTI, SCHD) — this satisfies all three simultaneously.

PRIORITY 4 — AGE AND GOAL MODE RULES (apply after priorities 1–3 are satisfied):
  Age and goal mode shape the mix within the space left by higher-priority rules.
  They do not override Priority 1 or 2 mandates.

PRIORITY 5 — EXPERIENCE RULES (filter complexity within whatever 1–4 mandate):
  New investor: simplify the picks required by higher rules — broad ETFs over sector ETFs, no individual stocks.
  Experienced: full range of instruments is available within the mandated mix.
  Experience rules never change WHAT must be included — only HOW complex the instruments can be.

PRIORITY 6 — SECTOR AND PREFERENCE RULES (apply only if they don't conflict with 1–5):
  If a sector preference conflicts with a higher rule (e.g. high debt + sector ETF preference):
    → follow the higher rule; ignore the sector preference for that slot.
  If the sector preference is compatible (e.g. healthcare dividend stock satisfies an income mandate):
    → use it.
═══════════════════════════════════════════════════════

── AGE RULES ─────────────────────────────────────────
Under 30: MANDATE at least 3 growth-oriented holdings (broad ETFs or growth stocks). Bond ETFs only if explicitly requested.
30–44: At least 2 growth holdings. At most 2 bond/income holdings. 1 flexible.
45–54: At least 1 bond ETF or dividend ETF. No more than 2 pure growth stocks.
55–64: At least 2 income or capital-preservation holdings (bond ETFs, dividend ETFs, REITs). Limit to 1 speculative or high-volatility stock.
65+: MANDATE at least 3 capital-preservation or income holdings. Do NOT include speculative or high-volatility stocks.

── PENSION + SOCIAL SECURITY INCOME RULES ────────────
Use the pre-computed "Monthly income gap" from CALCULATED FIELDS (below in the user prompt).
If income gap <= 0 (guaranteed income COVERS all expenses):
  MANDATE: At least 3 of 5 must be growth-oriented (broad market ETFs, growth stocks, balanced ETFs). Maximum 1 bond ETF. Do NOT prioritize income-generating holdings.
If income gap > $1,000/month (significant gap):
  MANDATE: At least 3 of 5 must be income-generating (dividend ETFs, bond ETFs, REITs, dividend stocks with yield > 2%). Maximum 1 pure growth holding with no dividend.
If income gap > $0 and <= $1,000/month (small gap):
  Include exactly 2 income-generating holdings, 2 growth holdings, and 1 flexible holding.
If no pension/SS data: Do not apply this rule — fall through to risk tolerance defaults.

── DEBT RULES ────────────────────────────────────────
If monthly debt payments > $1,500/month:
  MANDATE: Include at least 1 short-term bond ETF (e.g. VGSH, VCSH) or high-yield savings equivalent. The reasoning for that holding must explicitly name the debt burden as the reason for prioritizing liquidity.
If monthly debt payments > $3,000/month:
  Flag the high debt load prominently in advisorNarrative. Prioritize capital preservation. Limit growth picks to 1.

── CHILDREN / DEPENDENTS RULES ──────────────────────
If any children under age 10: Mention 529 education savings in at least 1 reasoning field.
If monthly dependent costs > $1,000: Treat as a fixed liability in advisorNarrative. Avoid illiquid or hard-to-sell securities.
If supporting aging parents: Treat as an additional recurring liability. Reduce speculative picks by 1 compared to what you would otherwise suggest.

── LIQUIDITY / SAVINGS RULES ────────────────────────
If liquidity ratio > 80% (floor is 80%+ of total savings):
  MANDATE: Only suggest highly liquid securities. No REITs with lock-ups, no illiquid instruments. Note this constraint in advisorNarrative.
If investment amount > 50% of total savings:
  Warn in advisorNarrative about concentration risk. Recommend staging the investment over time.
If no emergency fund, or emergency fund < 1 month of expenses:
  Flag this prominently in advisorNarrative. Include at least 1 capital-preservation option (short-term bond ETF, money market ETF).

── MONTHLY SURPLUS RULES ────────────────────────────
Use ONLY the "Surplus including pension/SS" value from CALCULATED FIELDS. This figure already includes pension and Social Security as income. Do NOT add pension or SS to it again — they are already factored in.
Formula used: surplus = monthlyIncome + pension + SS − expenses − debt − dependentCosts.
If monthlyIncome was left blank, the formula uses pension + SS as the full income — the surplus will still be correct.

If surplus (including pension/SS) < $200 or negative:
  EXCEPTION — check first: if pension alone >= monthlyExpenses (guaranteed income coverage is FULL):
    Do NOT trigger this safety rule. The negative surplus is almost certainly because monthlyIncome was left blank.
    The pension covers living costs. Apply the PENSION+SS INCOME RULE instead (MANDATE at least 3 growth-oriented suggestions).
    Do NOT flag cash flow as tight. Do NOT add capital-preservation picks on this basis alone.
  If pension < monthlyExpenses (income gap exists) AND surplus is still negative:
    MANDATE: At least 2 capital-preservation or income holdings. Note the tight cash flow explicitly in advisorNarrative.
If surplus (including pension/SS) > $2,000:
  Investor has a comfortable buffer. Growth-oriented picks are more appropriate. Acknowledge this financial flexibility in advisorNarrative.

── INVESTMENT EXPERIENCE RULES ──────────────────────
New to investing:
  MANDATE: Maximum 1 individual stock in the 5 suggestions. The remaining 4 must be broad, simple ETFs (e.g. VTI, SCHD, BND). No sector ETFs, no leveraged ETFs, no complex instruments. Use extra plain language in ALL reasoning fields.
Some experience:
  Maximum 2 individual stocks. At least 2 broad market ETFs. Sector ETFs are acceptable.
Experienced investor:
  Individual stocks, sector ETFs, covered-call ETFs, and REIT sub-sectors are all appropriate. More sophisticated income strategies are welcome.

── ACCOUNT TYPE RULES ───────────────────────────────
Taxable brokerage: Avoid bond ETFs (tax-inefficient). Prefer ETFs with low turnover and qualified dividends.
Roth IRA or Traditional IRA: Bond ETFs and high-dividend stocks are ideal — taxes are deferred or eliminated.
401(k) / employer plan: Suggest broad, low-cost index funds and target-date style allocations.
Multiple account types: Bond ETFs and high-dividend stocks in tax-advantaged accounts; growth ETFs in either; low-turnover index funds in taxable. Always mention the account type in reasoning when it meaningfully affects the suggestion.

── HOMEOWNERSHIP RULES ──────────────────────────────
Renting: Mention REIT exposure as a way to access real estate upside without property ownership. Include at least 1 REIT if the rest of the profile allows it.
Own outright (no mortgage): Low fixed obligations — treat as a positive capacity signal. Slightly more volatility is tolerable.
Paying a mortgage: Treat the mortgage as a fixed monthly obligation. Avoid illiquid real estate plays (liquid REITs are still fine).
Living with family / N/A: Low fixed costs — treat as a positive investable surplus signal. Reflect this capacity in the advisorNarrative.

── RISK TOLERANCE + CAPACITY COMBINED RULES ─────────
Low tolerance AND drop reaction is "sell everything":
  Ultra-conservative. MANDATE at least 3 bond ETFs or dividend-focused ETFs. No individual stocks.
Low tolerance AND hold period is long-term:
  Allow 1 broad market growth ETF (e.g. VTI) — long horizon mitigates short-term volatility risk.
High tolerance AND income gap > $1,000/month:
  The PENSION+SS INCOME RULE overrides stated tolerance. The user cannot afford to take on speculative risk when they need investment income for living expenses. Cap speculative/high-volatility picks at 1.
Medium tolerance:
  Balanced mix — 2–3 equities, 1–2 income/bond holdings, 1 flexible.

── EXISTING PORTFOLIO RULES ─────────────────────────
Stocks/ETFs allocation > 80%: MANDATE at least 1 bond ETF and 1 REIT for diversification.
Cash allocation > 50%: Note in advisorNarrative that excess cash loses value to inflation. Suggest deploying it gradually.
Bonds allocation > 60% AND age < 50: Gently note they may be over-allocated to bonds given their time horizon. Suggest 1–2 growth-oriented additions.
Real estate allocation > 30%: Limit REIT suggestions to 1.

── GOAL MODE RULES ──────────────────────────────────
just-starting: Prefer broad market ETFs and simple blue-chip stocks. No niche, leveraged, or speculative picks.
growing-wealth: Prefer equities and growth ETFs. Some diversification welcome. Sector ETFs acceptable.
approaching-retirement: Bias strongly toward income, stability, bond ETFs, dividend stocks, and REITs. Limit high-volatility picks to 1.
already-retired: MANDATE at least 3 capital-preservation or income holdings. No growth stocks or speculative assets.

── SECTOR INTEREST RULES ────────────────────────────
If sectors are specified: At least 2 of 5 suggestions must directly match a stated sector. Do not ignore stated sector interests.
If no sectors specified: Vary suggestions across at least 3 different sectors.
If themes of interest are specified: At least 1 suggestion must align with a stated theme (e.g. AI/tech, clean energy, healthcare).

═══════════════════════════════════════════════════════
(See RULE CONFLICT RESOLUTION at the top of this section for priority order.)

Field rules:
- type must be exactly one of: "stock" | "etf" | "bond_etf" | "reit"
- portfolioRole must be exactly one of: "core growth holding" | "income-oriented holding" | "defensive sector exposure" | "inflation-sensitive exposure" | "capital-preservation option" | "real estate income exposure" | "broad market exposure"
- retirementLens.incomeRole, volatility, liquidity, complexity must each be exactly "Low", "Medium", or "High"
- retirementLens.retirementFit must be one plain sentence
- watchOut must be one sentence under 20 words

General rules:
- Use only real, currently-listed US tickers on NYSE or NASDAQ (stocks, ETFs, bond ETFs, or REITs).
- Do not suggest penny stocks or OTC-only securities.
- Tailor complexity of reasoning to the risk profile: low = stable blue-chips, dividend ETFs, bond ETFs, or REITs; medium = balanced mix; high = growth/speculative stocks with horizon justification.
- reasoning must be exactly 2 sentences. No more. No exceptions.
- advisorNarrative must explicitly name every major BEHAVIORAL MANDATE RULE that fired and explain in plain English how it changed the suggestions. The user must finish reading it and understand exactly why they got these specific picks. Generic summaries ("I balanced growth and income") are not acceptable — name the specific fact that triggered each rule (dollar amounts, ages, ratios). End with one honest caveat.
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
  if (inputs.accountTypes?.length) lines.push(`Account types: ${inputs.accountTypes.join(', ')}`);
  if (inputs.employmentStatus) lines.push(`Employment: ${inputs.employmentStatus}`);
  if (inputs.emergencyFund)    lines.push(`Emergency fund: ${inputs.emergencyFund}`);
  if (inputs.existingInvestments?.length) lines.push(`Existing investments: ${inputs.existingInvestments.join(', ')}`);
  if (inputs.familySituation)  lines.push(`Family situation: ${inputs.familySituation}`);
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

  // Build deeper financial picture section — only include fields that were provided
  const deepLines = [];
  if (inputs.numChildren != null)        deepLines.push(`Children: ${inputs.numChildren}${inputs.childrenAges ? `, ages ${inputs.childrenAges}` : ''}`);
  if (inputs.monthlyDependentCosts)      deepLines.push(`Monthly dependent costs: $${inputs.monthlyDependentCosts.toLocaleString()}`);
  if (inputs.supportingAgingParents)     deepLines.push(`Supporting aging parents: ${inputs.supportingAgingParents}`);
  if (inputs.totalSavings)               deepLines.push(`Total current savings/investments: $${inputs.totalSavings.toLocaleString()}`);
  if (inputs.liquidityFloor)             deepLines.push(`Liquidity floor (never invest this): $${inputs.liquidityFloor.toLocaleString()}`);
  if (inputs.monthlyTakeHome)            deepLines.push(`Monthly take-home: $${inputs.monthlyTakeHome.toLocaleString()}`);
  if (inputs.monthlyExpenses)            deepLines.push(`Monthly essential expenses: $${inputs.monthlyExpenses.toLocaleString()}`);
  // Monthly surplus intentionally omitted here — the correct figure (including pension/SS)
  // is computed below in CALCULATED FIELDS as "Surplus including pension/SS". Do not pass
  // the raw client-side monthlySurplus, which excludes pension and SS income.
  if (inputs.hasPension) {
    const pensionLine = inputs.hasPension === 'yes' && inputs.pensionAmount
      ? `Pension: Yes — estimated $${Number(inputs.pensionAmount).toLocaleString()}/month at retirement`
      : `Pension: ${inputs.hasPension}`;
    deepLines.push(pensionLine);
  }
  if (inputs.expectedSocialSecurity)     deepLines.push(`Expected Social Security: $${inputs.expectedSocialSecurity.toLocaleString()}/month`);
  if (inputs.monthlyDebt)                deepLines.push(`Monthly debt payments: $${Number(inputs.monthlyDebt).toLocaleString()}/month`);
  if (inputs.homeownership)             deepLines.push(
    inputs.homeownership === 'na'
      ? 'Homeownership: N/A — living with family or not applicable'
      : `Homeownership: ${inputs.homeownership}`
  );
  if (inputs.investmentExperience) {
    const expLabel = { new: 'New to investing', some: 'Some experience', experienced: 'Experienced investor' };
    deepLines.push(`Investment experience: ${expLabel[inputs.investmentExperience] ?? inputs.investmentExperience}`);
  }
  const hasAlloc = inputs.allocStocks != null || inputs.allocBonds != null || inputs.allocCash != null || inputs.allocRealEstate != null;
  if (hasAlloc) {
    const parts = [];
    if (inputs.allocStocks    != null) parts.push(`${inputs.allocStocks}% stocks/ETFs`);
    if (inputs.allocBonds     != null) parts.push(`${inputs.allocBonds}% bonds`);
    if (inputs.allocCash      != null) parts.push(`${inputs.allocCash}% cash`);
    if (inputs.allocRealEstate != null) parts.push(`${inputs.allocRealEstate}% real estate/other`);
    deepLines.push(`Current allocation: ${parts.join(', ')}`);
  }
  if (inputs.targetRetirementAge) {
    const yearsAway = inputs.age ? Math.max(0, inputs.targetRetirementAge - inputs.age) : null;
    deepLines.push(`Target retirement age: ${inputs.targetRetirementAge}${yearsAway !== null ? ` (${yearsAway} years away)` : ''}`);
  }

  const deepSection = deepLines.length
    ? `\nDEEPER FINANCIAL PICTURE:\n${deepLines.map((l) => `- ${l}`).join('\n')}`
    : '';

  // ── CALCULATED FIELDS ──────────────────────────────────────────────────────
  // Pre-compute derived values so Claude doesn't have to infer them from raw numbers.
  const calcLines = [];

  // Only count pension when user confirmed they have one — avoids stale pensionAmount persisting
  const effectivePensionAmount = (inputs.hasPension === 'yes') ? (Number(inputs.pensionAmount) || 0) : 0;
  const pension   = effectivePensionAmount;
  const ss        = inputs.expectedSocialSecurity ? Number(inputs.expectedSocialSecurity) : 0;
  const expenses  = inputs.monthlyExpenses        ? Number(inputs.monthlyExpenses)        : 0;
  const takeHome  = inputs.monthlyTakeHome        ? Number(inputs.monthlyTakeHome)        : 0;
  const debt      = inputs.monthlyDebt            ? Number(inputs.monthlyDebt)            : 0;
  const depCosts  = inputs.monthlyDependentCosts  ? Number(inputs.monthlyDependentCosts)  : 0;
  const savings   = inputs.totalSavings           ? Number(inputs.totalSavings)           : 0;
  const floor     = inputs.liquidityFloor         ? Number(inputs.liquidityFloor)         : 0;
  const amount    = inputs.amount                 ? Number(inputs.amount)                 : 0;

  if (expenses > 0 || pension > 0 || ss > 0) {
    const gap = expenses - pension - ss;
    if (gap <= 0) {
      calcLines.push(`Monthly income gap: $0 — guaranteed income FULLY covers expenses (surplus: $${Math.abs(gap).toLocaleString()}/month)`);
      calcLines.push(`Guaranteed income coverage: FULL — investments are for growth/inflation protection only`);
    } else if (gap <= 1000) {
      calcLines.push(`Monthly income gap: $${gap.toLocaleString()}/month — small shortfall`);
      calcLines.push(`Guaranteed income coverage: PARTIAL — small gap of $${gap.toLocaleString()}/month`);
    } else {
      calcLines.push(`Monthly income gap: $${gap.toLocaleString()}/month — significant shortfall`);
      calcLines.push(`Guaranteed income coverage: PARTIAL — significant gap of $${gap.toLocaleString()}/month; investments must help fill this`);
    }
  }

  // Surplus including pension/SS — this is the authoritative surplus figure Claude must use.
  // Formula: monthlyIncome + pension + SS − expenses − debt − dependentCosts
  if (takeHome > 0 || pension > 0 || ss > 0) {
    const surplusWithGuaranteed = takeHome + pension + ss - expenses - debt - depCosts;
    const pensionCoversExpenses = pension >= expenses && expenses > 0;
    let surplusLabel;
    if (pensionCoversExpenses && surplusWithGuaranteed < 200) {
      surplusLabel = ' (monthlyIncome may be blank — pension covers expenses; do NOT trigger negative surplus rule)';
    } else if (surplusWithGuaranteed < 0) {
      surplusLabel = ' ⚠ CASH FLOW NEGATIVE';
    } else if (surplusWithGuaranteed < 200) {
      surplusLabel = ' ⚠ very tight';
    } else {
      surplusLabel = '';
    }
    calcLines.push(`Surplus including pension/SS (income + pension + SS − expenses − debt − dependent costs): $${surplusWithGuaranteed.toLocaleString()}/month${surplusLabel}`);
  }

  if (savings > 0 && floor > 0) {
    const ratio = Math.round((floor / savings) * 100);
    const warn  = ratio > 80 ? ' ⚠ WARNING: most savings must stay liquid' : '';
    calcLines.push(`Liquidity ratio (floor ÷ total savings): ${ratio}%${warn}`);
  }

  if (savings > 0 && amount > 0) {
    const pct  = Math.round((amount / savings) * 100);
    const warn = pct > 50 ? ' ⚠ WARNING: large share of total savings' : '';
    calcLines.push(`Investment amount as % of total savings: ${pct}%${warn}`);
  }

  if (inputs.age && inputs.targetRetirementAge) {
    const yrs = Math.max(0, Number(inputs.targetRetirementAge) - Number(inputs.age));
    calcLines.push(`Years to target retirement: ${yrs}`);
  }

  const calcSection = calcLines.length
    ? `\nCALCULATED FIELDS (pre-computed for your convenience — use these directly in BEHAVIORAL MANDATE RULES):\n${calcLines.map((l) => `- ${l}`).join('\n')}`
    : '';

  return `
Investor profile:
${profile}

Goal mode guidance: ${goalNote}
${retirementNote ? retirementNote + '\n' : ''}
Use ALL of the above profile details to personalize every suggestion. Reference specific profile facts in the reasoning field — for example mention the college tuition timeline, the income bracket, the drop reaction, or the family situation where relevant.
${deepSection}
${calcSection}
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

  // Known mutual fund ticker prefixes / patterns — not exchange-traded, Finnhub can't price them
  const MUTUAL_FUND_RE = /^(VFIAX|VTSAX|VTIAX|VBTLX|FXAIX|FSPGX|FZILX|FBALX|FDVV|FZROX|FZIPX|FZILX|FXNAX|FNILX)/;
  // 5-letter tickers ending in X are usually mutual funds (ETFs are typically 3-4 letters)
  const LIKELY_MUTUAL_FUND_RE = /^[A-Z]{5}X$/;
  // Tickers that resolve to the wrong security (e.g. ambiguous or misidentified)
  const BLOCKED_TICKERS = new Set(['TIPS']); // TIPS = Chinese company, not inflation ETF; use TIP or SCHP

  // Validate and filter to well-formed suggestions
  const TICKER_RE = /^[A-Z]{1,5}$/;
  const suggestions = parsed.suggestions
    .filter(
      (s) => {
        if (!s || typeof s.ticker !== 'string') return false;
        if (!TICKER_RE.test(s.ticker)) return false;
        if (typeof s.reasoning !== 'string' || s.reasoning.length === 0) return false;
        if (MUTUAL_FUND_RE.test(s.ticker)) {
          console.warn(`[claudeService] Filtered mutual fund ticker: ${s.ticker}`);
          return false;
        }
        if (LIKELY_MUTUAL_FUND_RE.test(s.ticker)) {
          console.warn(`[claudeService] Filtered likely mutual fund ticker: ${s.ticker}`);
          return false;
        }
        if (BLOCKED_TICKERS.has(s.ticker)) {
          console.warn(`[claudeService] Filtered blocked ticker: ${s.ticker}`);
          return false;
        }
        return true;
      }
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
