const VALID_RISK = ['low', 'medium', 'high'];
const VALID_HOLD = ['short', 'medium', 'long'];
const KNOWN_SECTORS = [
  'Technology', 'Healthcare', 'Finance', 'Energy',
  'Consumer', 'Utilities', 'Real Estate', 'Industrials', 'Materials',
];

export function validateInputs(body) {
  const { riskProfile, amount, holdPeriod, sectors } = body;

  if (!VALID_RISK.includes(riskProfile)) {
    const err = new Error('Invalid risk profile. Must be low, medium, or high.');
    err.statusCode = 400;
    throw err;
  }

  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt <= 0) {
    const err = new Error('Amount must be a positive number.');
    err.statusCode = 400;
    throw err;
  }

  if (!VALID_HOLD.includes(holdPeriod)) {
    const err = new Error('Invalid hold period. Must be short, medium, or long.');
    err.statusCode = 400;
    throw err;
  }

  const cleanSectors = Array.isArray(sectors)
    ? sectors.filter((s) => KNOWN_SECTORS.includes(s))
    : [];

  return { riskProfile, amount: amt, holdPeriod, sectors: cleanSectors };
}
