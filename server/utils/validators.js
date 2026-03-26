const VALID_RISK       = ['low', 'medium', 'high'];
const VALID_HOLD       = ['short', 'medium', 'long'];
const VALID_GOAL_MODES = ['just-starting', 'growing-wealth', 'approaching-retirement', 'already-retired'];
const KNOWN_SECTORS    = [
  'Technology', 'Healthcare', 'Finance', 'Energy',
  'Consumer', 'Utilities', 'Real Estate', 'Industrials', 'Materials',
];

function cleanString(val) {
  return typeof val === 'string' ? val.trim() : '';
}

function cleanStringArray(val) {
  return Array.isArray(val) ? val.filter((s) => typeof s === 'string') : [];
}

export function validateInputs(body) {
  const {
    riskProfile, amount, holdPeriod, sectors, goalMode, age,
    annualIncome, accountType, employmentStatus, emergencyFund, existingInvestments,
    familySituation, homeownership, upcomingExpenses,
    priorities, dropReaction, themes, involvement, investmentPurpose,
  } = body;

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

  const cleanSectors  = Array.isArray(sectors) ? sectors.filter((s) => KNOWN_SECTORS.includes(s)) : [];
  const cleanGoalMode = VALID_GOAL_MODES.includes(goalMode) ? goalMode : 'growing-wealth';
  const cleanAge      = (Number.isFinite(Number(age)) && Number(age) > 0 && Number(age) <= 120) ? Math.floor(Number(age)) : null;

  return {
    riskProfile, amount: amt, holdPeriod, sectors: cleanSectors, goalMode: cleanGoalMode, age: cleanAge,
    annualIncome:       cleanString(annualIncome),
    accountType:        cleanString(accountType),
    employmentStatus:   cleanString(employmentStatus),
    emergencyFund:      cleanString(emergencyFund),
    existingInvestments: cleanStringArray(existingInvestments),
    familySituation:    cleanString(familySituation),
    homeownership:      cleanString(homeownership),
    upcomingExpenses:   cleanStringArray(upcomingExpenses),
    priorities:         cleanStringArray(priorities),
    dropReaction:       cleanString(dropReaction),
    themes:             cleanStringArray(themes),
    involvement:        cleanString(involvement),
    investmentPurpose:  cleanString(investmentPurpose),
  };
}
