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
    annualIncome, accountTypes, employmentStatus, emergencyFund, existingInvestments,
    familySituation, homeownership, upcomingExpenses,
    priorities, dropReaction, themes, involvement, investmentPurpose,
    // Refined financial picture (optional)
    numChildren, childrenAges, monthlyDependentCosts, supportingAgingParents,
    totalSavings, liquidityFloor, monthlyTakeHome, monthlyExpenses, monthlySurplus,
    hasPension, expectedSocialSecurity, targetRetirementAge,
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
    accountTypes:       cleanStringArray(accountTypes),
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
    // Refined financial picture
    numChildren:          (Number.isFinite(Number(numChildren)) && Number(numChildren) >= 0) ? Math.floor(Number(numChildren)) : null,
    childrenAges:         cleanString(childrenAges) || null,
    monthlyDependentCosts: Number.isFinite(Number(monthlyDependentCosts)) && Number(monthlyDependentCosts) > 0 ? Number(monthlyDependentCosts) : null,
    supportingAgingParents: ['yes', 'no'].includes(supportingAgingParents) ? supportingAgingParents : null,
    totalSavings:         Number.isFinite(Number(totalSavings)) && Number(totalSavings) > 0 ? Number(totalSavings) : null,
    liquidityFloor:       Number.isFinite(Number(liquidityFloor)) && Number(liquidityFloor) > 0 ? Number(liquidityFloor) : null,
    monthlyTakeHome:      Number.isFinite(Number(monthlyTakeHome)) && Number(monthlyTakeHome) > 0 ? Number(monthlyTakeHome) : null,
    monthlyExpenses:      Number.isFinite(Number(monthlyExpenses)) && Number(monthlyExpenses) > 0 ? Number(monthlyExpenses) : null,
    monthlySurplus:       Number.isFinite(Number(monthlySurplus)) ? Number(monthlySurplus) : null,
    hasPension:           ['yes', 'no', 'not-sure'].includes(hasPension) ? hasPension : null,
    expectedSocialSecurity: Number.isFinite(Number(expectedSocialSecurity)) && Number(expectedSocialSecurity) > 0 ? Number(expectedSocialSecurity) : null,
    targetRetirementAge:  (Number.isFinite(Number(targetRetirementAge)) && Number(targetRetirementAge) >= 18) ? Math.floor(Number(targetRetirementAge)) : null,
  };
}
