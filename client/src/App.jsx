import { useState, useRef, useEffect } from 'react';
import { fetchSuggestions, fetchMarketRates } from './api/suggestions.js';
import { fetchForecast } from './api/forecast.js';
import { getMe, saveProfile, getHoldings } from './services/auth.js';
import { supabase } from './lib/supabase.js';
import PortfolioPage from './components/PortfolioPage.jsx';
import AddInvestmentModal from './components/AddInvestmentModal.jsx';
import DisclaimerBanner from './components/DisclaimerBanner.jsx';
import Nav from './components/Nav.jsx';
import InputForm from './components/InputForm.jsx';
import OnboardingFlow from './components/OnboardingFlow.jsx';
import StockGrid from './components/StockGrid.jsx';
import LoadingState from './components/LoadingState.jsx';
import ErrorBanner from './components/ErrorBanner.jsx';
import ForecastForm from './components/ForecastForm.jsx';
import ForecastResult from './components/ForecastResult.jsx';
import ForecastLoadingState from './components/ForecastLoadingState.jsx';
import ForecastChart from './components/ForecastChart.jsx';
import AuthModal from './components/AuthModal.jsx';
import SavedPlansModal from './components/SavedPlansModal.jsx';
import LandingPage from './components/LandingPage.jsx';
import DashboardPanel from './components/DashboardPanel.jsx';
import EditProfileModal from './components/EditProfileModal.jsx';

// ── Password Reset Overlay ────────────────────────────────────────────────────
// Rendered when onAuthStateChange fires a PASSWORD_RECOVERY event (user landed
// from a password-reset email link). Calls supabase.auth.updateUser to commit
// the new password, then dismisses itself.

function PasswordResetModal({ onDone }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [done, setDone]         = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    if (password !== confirm)  { setError('Passwords do not match'); return; }
    setLoading(true);
    try {
      const { error: authError } = await supabase.auth.updateUser({ password });
      if (authError) { setError(authError.message); return; }
      setDone(true);
      setTimeout(onDone, 1500);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const OVERLAY = {
    position: 'fixed', inset: 0, zIndex: 300,
    background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 'var(--space-4)',
  };
  const CARD = {
    width: '100%', maxWidth: 400,
    background: 'var(--bg-card)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)', padding: 'var(--space-6)',
  };
  const INPUT_STYLE = {
    width: '100%', padding: '9px 12px',
    background: 'var(--bg-input)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)',
    fontSize: 13, fontFamily: "'DM Mono', monospace", boxSizing: 'border-box',
  };

  return (
    <div style={OVERLAY}>
      <div style={CARD}>
        <h2 style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: 22, fontWeight: 400, marginBottom: 'var(--space-4)' }}>
          Set a new password
        </h2>
        {done ? (
          <p style={{ fontSize: 13, color: 'var(--accent-green)', fontFamily: "'DM Mono', monospace" }}>
            Password updated ✓
          </p>
        ) : (
          <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', fontFamily: "'DM Mono', monospace", marginBottom: 5 }}>New Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min. 8 characters" style={INPUT_STYLE} autoFocus />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', fontFamily: "'DM Mono', monospace", marginBottom: 5 }}>Confirm Password</label>
              <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Repeat password" style={INPUT_STYLE} />
            </div>
            {error && <p style={{ fontSize: 11, color: 'var(--accent-red)', fontFamily: "'DM Mono', monospace", margin: 0 }}>{error}</p>}
            <button
              type="submit" disabled={loading}
              style={{
                marginTop: 'var(--space-1)', padding: '10px 16px',
                background: loading ? 'var(--bg-input)' : 'var(--accent-green)',
                border: 'none', borderRadius: 'var(--radius)',
                color: loading ? 'var(--text-muted)' : '#000',
                fontSize: 13, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
                fontFamily: "'DM Mono', monospace",
              }}
            >
              {loading ? 'Saving...' : 'Update Password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

// Compute exact age from { day (optional), month (1-12), year } at call time.
// Falls back to day=1 for legacy profiles that only stored month+year.
function calcAgeFromDOB(dob) {
  if (!dob?.year) return null;
  const today = new Date();
  const birth = new Date(Number(dob.year), Number(dob.month) - 1, Number(dob.day ?? 1));
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age--;
  return age > 0 && age < 130 ? age : null;
}

// Enrich a stored profile with a freshly-calculated age from dateOfBirth.
// Falls back to the stored age for old profiles that predate DOB storage.
function withFreshAge(inputs) {
  if (!inputs) return inputs;
  if (inputs.dateOfBirth?.year) {
    return { ...inputs, age: calcAgeFromDOB(inputs.dateOfBirth) };
  }
  return inputs;
}

const INITIAL_REFINE = {
  numChildren:            '',
  childrenAges:           '',
  monthlyDependentCosts:  '',
  supportingAgingParents: null,
  totalSavings:           '',
  liquidityFloor:         '',
  monthlyTakeHome:        '',
  monthlyExpenses:        '',
  hasPension:             null,
  pensionAmount:          '',
  expectedSocialSecurity: '',
  targetRetirementAge:    '',
  monthlyDebt:            '',
  homeownership:          null,
  investmentExperience:   null,
  allocStocks:            '',
  allocBonds:             '',
  allocCash:              '',
  allocRealEstate:        '',
};

function buildMergedInputs(profileInputs, refineInputs) {
  if (!profileInputs) return null;
  const r = refineInputs ?? INITIAL_REFINE;
  // Recalculate age from DOB on every merge so it's always current-year-accurate
  const freshAge = profileInputs.dateOfBirth?.year ? calcAgeFromDOB(profileInputs.dateOfBirth) : (profileInputs.age ?? null);
  const takeHome  = Number(r.monthlyTakeHome) || 0;
  const pension   = (r.hasPension === 'yes') ? (Number(r.pensionAmount) || 0) : 0;
  const ss        = Number(r.expectedSocialSecurity) || 0;
  const expenses  = Number(r.monthlyExpenses) || 0;
  const debt      = Number(r.monthlyDebt) || 0;
  const totalIncome = takeHome + pension + ss;
  const showSurplus = r.monthlyTakeHome !== '' || r.monthlyExpenses !== '' || (r.hasPension === 'yes' && r.pensionAmount !== '') || r.expectedSocialSecurity !== '';
  // For each refine field: use the refine value when explicitly set, otherwise keep the
  // profileInputs value. This prevents unset refine fields from overriding profile data
  // with null/zero when the user hasn't touched that field.
  const p = profileInputs;
  const num  = (refineVal, profileKey) => refineVal !== '' ? Number(refineVal) : (p[profileKey] ?? null);
  const pill = (refineVal, profileKey) => refineVal || p[profileKey] || null;

  return {
    ...p,
    age: freshAge,
    numChildren:             num(r.numChildren,            'numChildren'),
    childrenAges:            r.childrenAges || p.childrenAges || null,
    monthlyDependentCosts:   num(r.monthlyDependentCosts,  'monthlyDependentCosts'),
    supportingAgingParents:  pill(r.supportingAgingParents, 'supportingAgingParents'),
    totalSavings:            num(r.totalSavings,            'totalSavings'),
    liquidityFloor:          num(r.liquidityFloor,          'liquidityFloor'),
    monthlyTakeHome:         num(r.monthlyTakeHome,         'monthlyTakeHome'),
    monthlyExpenses:         num(r.monthlyExpenses,         'monthlyExpenses'),
    monthlySurplus:          showSurplus ? (totalIncome - expenses - debt) : (p.monthlySurplus ?? null),
    hasPension:              pill(r.hasPension,             'hasPension'),
    pensionAmount:           num(r.pensionAmount,           'pensionAmount'),
    expectedSocialSecurity:  num(r.expectedSocialSecurity, 'expectedSocialSecurity'),
    targetRetirementAge:     num(r.targetRetirementAge,    'targetRetirementAge'),
    monthlyDebt:             num(r.monthlyDebt,            'monthlyDebt'),
    homeownership:           pill(r.homeownership,          'homeownership'),
    investmentExperience:    pill(r.investmentExperience,   'investmentExperience'),
    allocStocks:             num(r.allocStocks,             'allocStocks'),
    allocBonds:              num(r.allocBonds,              'allocBonds'),
    allocCash:               num(r.allocCash,               'allocCash'),
    allocRealEstate:         num(r.allocRealEstate,         'allocRealEstate'),
  };
}

export default function App() {
  const savedTab = localStorage.getItem('meridian_active_tab') ?? 'home';
  const [currentPage, setCurrentPage] = useState(savedTab);

  function navigate(page) {
    setCurrentPage(page);
    localStorage.setItem('meridian_active_tab', page);
  }

  // Auth state
  const [user, setUser]                   = useState(null);
  const [token, setToken]                 = useState(null);
  const [authChecked, setAuthChecked]     = useState(false);
  const [authModalTab, setAuthModalTab]   = useState('signin');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showSavedPlans, setShowSavedPlans] = useState(false);
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [toast, setToast]                 = useState(null);

  // Profile/dashboard state
  const [hasProfile, setHasProfile]       = useState(false);
  const [profileInputs, setProfileInputs] = useState(null);
  const [refineInputs, setRefineInputs]   = useState(INITIAL_REFINE);
  const [isRefineUpdating, setIsRefineUpdating] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showFullForm, setShowFullForm]   = useState(false);

  // Home page state
  const [cards, setCards] = useState(null);
  const [advisorNarrative, setAdvisorNarrative] = useState(null);
  const [treasuryRates, setTreasuryRates] = useState(null);
  const [lastInputs, setLastInputs] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [planIsSaved, setPlanIsSaved] = useState(false);
  const [planUpdatedAt, setPlanUpdatedAt] = useState(null);

  // Portfolio state
  const [portfolioTickers, setPortfolioTickers] = useState(new Set());
  const [showAddPortfolioModal, setShowAddPortfolioModal] = useState(false);
  const [addPortfolioCard, setAddPortfolioCard]           = useState(null);

  // Forecast page state
  const [forecast, setForecast] = useState(null);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [forecastError, setForecastError] = useState(null);
  const [forecastTicker, setForecastTicker] = useState('');
  const [forecastSearchTicker, setForecastSearchTicker] = useState('');
  const [forecastCompanyName, setForecastCompanyName] = useState('');
  const [forecastQuote, setForecastQuote] = useState(null);
  const [forecastStockPE, setForecastStockPE] = useState(null);
  const [forecastSectorPE, setForecastSectorPE] = useState(null);

  // Refs to track latest values in async callbacks
  const tokenRef         = useRef(token);
  const profileRef       = useRef(profileInputs);
  const refineRef        = useRef(refineInputs);
  const cardsRef         = useRef(cards);
  const narrativeRef     = useRef(advisorNarrative);
  useEffect(() => { tokenRef.current = token; },              [token]);
  useEffect(() => { profileRef.current = profileInputs; },    [profileInputs]);
  useEffect(() => { refineRef.current = refineInputs; },      [refineInputs]);
  useEffect(() => { cardsRef.current = cards; },              [cards]);
  useEffect(() => { narrativeRef.current = advisorNarrative; }, [advisorNarrative]);

  // No auto-fetch on load — saved plan is shown immediately from DB cache.
  // AI only runs when user explicitly clicks "Refresh My Plan →" or "Update My Plan →".

  // Restore auth via Supabase session (handles refresh tokens automatically).
  // onAuthStateChange fires INITIAL_SESSION on mount so we never need localStorage.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setShowPasswordReset(true);
        setAuthChecked(true);
        return;
      }

      if (event === 'SIGNED_OUT') {
        setUser(null);
        setToken(null);
        setAuthChecked(true);
        return;
      }

      if (session) {
        const authUser  = session.user;
        const authToken = session.access_token;
        setUser(authUser);
        setToken(authToken);

        if (event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') {
          // On initial load, fetch profile + portfolio
          if (event === 'INITIAL_SESSION') {
            fetchPortfolioHoldings(authToken);
            getMe(authToken)
              .then((meData) => {
                console.log('[mount] getMe response:', JSON.stringify({
                  hasProfile: !!meData.savedProfile,
                  hasInputs: !!meData.savedProfile?.inputs,
                  hasCards: !!meData.savedProfile?.lastCards,
                  cardCount: meData.savedProfile?.lastCards?.length ?? 0,
                }));
                if (meData.savedProfile) {
                  const { inputs, refineInputs: savedRefine, lastCards, lastAdvisorNarrative } = meData.savedProfile;
                  setProfileInputs(withFreshAge(inputs));
                  setHasProfile(true);
                  if (savedRefine) setRefineInputs(savedRefine);
                  if (lastCards) {
                    setCards(lastCards);
                    setLastInputs(buildMergedInputs(inputs, savedRefine));
                    setAdvisorNarrative(lastAdvisorNarrative ?? null);
                    setPlanIsSaved(true);
                    setPlanUpdatedAt(meData.savedProfile.lastUpdatedAt ?? null);
                    console.log('[mount] restored', lastCards.length, 'cards from DB ✓');
                    fetchMarketRates().then((rates) => {
                      console.log('[mount] fetchMarketRates result:', rates);
                      if (rates) setTreasuryRates(rates);
                    });
                  } else {
                    console.log('[mount] profile found but no cached cards');
                  }
                } else {
                  console.log('[mount] no saved profile — showing onboarding');
                }
              })
              .catch((err) => console.error('[mount] getMe failed:', err.message))
              .finally(() => setAuthChecked(true));
          } else {
            // TOKEN_REFRESHED: just update token in state, no profile re-fetch needed
            setAuthChecked(true);
          }
        } else {
          setAuthChecked(true);
        }
      } else {
        // No session on INITIAL_SESSION means user is logged out
        setAuthChecked(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Auto-clear toast after 3 seconds
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);


  async function handleAuthSuccess(authUser, authToken) {
    // Session state is managed by Supabase — no localStorage writes needed.
    // We still call setUser/setToken immediately so the UI updates without
    // waiting for the next onAuthStateChange event.
    setUser(authUser);
    setToken(authToken);
    setShowAuthModal(false);
    fetchPortfolioHoldings(authToken);
    try {
      const meData = await getMe(authToken);
      if (meData.savedProfile) {
        const { inputs, refineInputs: savedRefine, lastCards, lastAdvisorNarrative } = meData.savedProfile;
        setProfileInputs(withFreshAge(inputs));
        setHasProfile(true);
        if (savedRefine) setRefineInputs(savedRefine);
        if (lastCards) {
          setCards(lastCards);
          setLastInputs(buildMergedInputs(inputs, savedRefine));
          setAdvisorNarrative(lastAdvisorNarrative ?? null);
          setPlanIsSaved(true);
          setPlanUpdatedAt(meData.savedProfile.lastUpdatedAt ?? null);
          fetchMarketRates().then((rates) => {
            if (rates) setTreasuryRates(rates);
          });
        }
        // No cached results — user will see "generate plan" state and click the button
      }
      // No savedProfile → user stays on onboarding (hasProfile = false)
    } catch (err) {
      console.error('[login] getMe failed:', err.message);
    }
  }

  async function fetchPortfolioHoldings(authToken) {
    try {
      const data = await getHoldings(authToken);
      setPortfolioTickers(new Set(data.holdings.map((h) => h.ticker)));
    } catch {
      // non-critical — portfolio indicators just won't show
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    localStorage.removeItem('meridian_active_tab');
    setUser(null);
    setToken(null);
    setCards(null);
    setLastInputs(null);
    setAdvisorNarrative(null);
    setPlanUpdatedAt(null);
    setHasProfile(false);
    setProfileInputs(null);
    setRefineInputs(INITIAL_REFINE);
    setPortfolioTickers(new Set());
  }

  function handleAddToPortfolio(card) {
    setAddPortfolioCard(card);
    setShowAddPortfolioModal(true);
  }

  function handleAddPortfolioSuccess(ticker) {
    setShowAddPortfolioModal(false);
    setAddPortfolioCard(null);
    setPortfolioTickers((prev) => new Set([...prev, ticker]));
  }

  function handleLoadPlan(plan) {
    setCards(plan.cards);
    setLastInputs(plan.inputs);
    setAdvisorNarrative(plan.advisorNarrative ?? null);
    setTreasuryRates(null);
    navigate('home');
  }

  // Core submit — returns { cards, advisorNarrative, updatedAt } or null on error
  async function handleSubmitCore(formData) {
    setPlanIsSaved(false);
    setLoading(true);
    setError(null);
    setCards(null);
    setAdvisorNarrative(null);
    setTreasuryRates(null);
    setLastInputs(formData);
    try {
      const { cards: newCards, advisorNarrative: narrative, treasuryRates: rates } = await fetchSuggestions(formData);
      const updatedAt = new Date().toISOString();
      setCards(newCards);
      setAdvisorNarrative(narrative);
      setTreasuryRates(rates);
      setPlanUpdatedAt(updatedAt);
      return { cards: newCards, advisorNarrative: narrative, updatedAt };
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }

  // First-time setup: called when new user completes onboarding
  async function handleFirstSetup(formData) {
    setProfileInputs(withFreshAge(formData));
    setHasProfile(true);
    const result = await handleSubmitCore(formData);
    const tok = tokenRef.current;
    console.log('[handleFirstSetup] result:', !!result, '| token:', tok ? tok.slice(0, 20) + '…' : 'null');
    if (result && tok) {
      saveProfile(tok, {
        inputs: formData,
        refineInputs: INITIAL_REFINE,
        lastCards: result.cards,
        lastAdvisorNarrative: result.advisorNarrative ?? null,
        lastUpdatedAt: result.updatedAt,
      })
        .then(() => console.log('[handleFirstSetup] profile saved to DB ✓'))
        .catch((err) => console.error('[handleFirstSetup] profile save failed:', err.message));
    } else {
      console.warn('[handleFirstSetup] skipping save — result:', !!result, 'token:', !!tok);
    }
  }

  // Edit profile save — updates profile state and DB without re-running AI.
  // User clicks "Refresh My Plan →" on the dashboard if they want new suggestions.
  async function handleEditProfileSave(newInputs) {
    setProfileInputs(withFreshAge(newInputs));
    const tok  = tokenRef.current;
    const ri   = refineRef.current;
    if (tok) {
      saveProfile(tok, {
        inputs:              newInputs,
        refineInputs:        ri,
        lastCards:           cardsRef.current,
        lastAdvisorNarrative: narrativeRef.current ?? null,
      }).catch(() => {});
    }
    // Modal handles "Saved ✓" display and closes itself after 2s
  }

  // Called by DashboardPanel on any field change
  function handleRefineChange(updates) {
    setRefineInputs((prev) => ({ ...prev, ...updates }));
  }

  // Called when user clicks "Update My Plan →" in refine panel
  async function handleRefineUpdate(onSuccess) {
    if (isRefineUpdating) return;
    const prof = profileRef.current;
    const ri   = refineRef.current;
    const tok  = tokenRef.current;
    if (!prof) return;
    setIsRefineUpdating(true);
    const merged = buildMergedInputs(prof, ri);
    const result = await handleSubmitCore(merged);
    setIsRefineUpdating(false);
    if (result) {
      onSuccess?.();
      if (tok) {
        saveProfile(tok, {
          inputs: prof,
          refineInputs: ri,
          lastCards: result.cards,
          lastAdvisorNarrative: result.advisorNarrative ?? null,
          lastUpdatedAt: result.updatedAt,
        }).catch(() => {});
      }
    }
  }

  // Explicit refresh — re-runs AI with current profile, saves result
  async function handleRefreshPlan() {
    const prof = profileRef.current;
    const ri   = refineRef.current;
    const tok  = tokenRef.current;
    if (!prof) return;
    const merged = buildMergedInputs(prof, ri);
    const result = await handleSubmitCore(merged);
    if (result && tok) {
      saveProfile(tok, {
        inputs: prof,
        refineInputs: ri,
        lastCards: result.cards,
        lastAdvisorNarrative: result.advisorNarrative ?? null,
        lastUpdatedAt: result.updatedAt,
      }).catch(() => {});
    }
  }

  function openAuthModal(tab) {
    setAuthModalTab(tab);
    setShowAuthModal(true);
  }

  // Ref-based handshake: decouple loading animation from API response timing
  const pendingResultRef = useRef(null);
  const animReadyRef = useRef(false);

  function applyResult(result) {
    setForecast(result.forecast);
    setForecastTicker(result.ticker);
    setForecastCompanyName(result.companyName);
    setForecastQuote(result.quote ?? null);
    setForecastStockPE(result.stockPE ?? null);
    setForecastSectorPE(result.sectorAvgPE ?? null);
    setForecastLoading(false);
  }

  function handleAnimationReady() {
    animReadyRef.current = true;
    if (pendingResultRef.current) {
      applyResult(pendingResultRef.current);
      pendingResultRef.current = null;
    }
  }

  async function handleForecast(ticker) {
    pendingResultRef.current = null;
    animReadyRef.current = false;
    setForecastSearchTicker(ticker);
    setForecastLoading(true);
    setForecastError(null);
    setForecast(null);
    setForecastStockPE(null);
    setForecastSectorPE(null);
    try {
      const result = await fetchForecast(ticker);
      if (animReadyRef.current) {
        applyResult(result);
      } else {
        pendingResultRef.current = result;
      }
    } catch (err) {
      setForecastError(err.message);
      setForecastLoading(false);
    }
  }

  // Avoid flash: wait for localStorage token check before rendering
  if (!authChecked) return null;

  // Not logged in → show landing page
  if (!user) {
    return (
      <div style={{ minHeight: '100vh' }}>
        {showPasswordReset && <PasswordResetModal onDone={() => setShowPasswordReset(false)} />}
        {showAuthModal && (
          <AuthModal
            defaultTab={authModalTab}
            onSuccess={handleAuthSuccess}
            onClose={() => setShowAuthModal(false)}
          />
        )}
        <LandingPage
          onRegister={() => openAuthModal('register')}
          onSignIn={() => openAuthModal('signin')}
        />
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* Password reset overlay (triggered by email link) */}
      {showPasswordReset && <PasswordResetModal onDone={() => setShowPasswordReset(false)} />}

      {/* Auth modals */}
      {showAuthModal && (
        <AuthModal
          defaultTab={authModalTab}
          onSuccess={handleAuthSuccess}
          onClose={() => setShowAuthModal(false)}
        />
      )}
      {showSavedPlans && token && (
        <SavedPlansModal token={token} onClose={() => setShowSavedPlans(false)} onLoad={handleLoadPlan} />
      )}
      {showAddPortfolioModal && token && (
        <AddInvestmentModal
          token={token}
          initialTicker={addPortfolioCard?.ticker}
          initialName={addPortfolioCard?.name}
          initialSecurityType={addPortfolioCard?.type}
          onSuccess={handleAddPortfolioSuccess}
          onClose={() => { setShowAddPortfolioModal(false); setAddPortfolioCard(null); }}
        />
      )}
      {showEditProfile && profileInputs && (
        <EditProfileModal
          profileInputs={profileInputs}
          onSave={handleEditProfileSave}
          onClose={() => setShowEditProfile(false)}
        />
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 300,
          background: 'var(--bg-card)', border: '1px solid var(--accent-green)',
          borderRadius: 'var(--radius)', padding: '10px 20px',
          fontSize: 12, color: 'var(--accent-green-bright)', fontFamily: "'DM Mono', monospace",
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
          pointerEvents: 'none',
        }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <Nav
        currentPage={currentPage}
        onNavigate={navigate}
        user={user}
        onSignIn={() => openAuthModal('signin')}
        onSignOut={signOut}
        onShowSavedPlans={() => setShowSavedPlans(true)}
        onEditProfile={() => setShowEditProfile(true)}
      />

      <DisclaimerBanner />

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 var(--space-6) var(--space-8)' }}>

        {/* Home Page */}
        {currentPage === 'home' && (
          <div className="layout-grid" style={{ gridTemplateColumns: '300px 1fr' }}>
            <div className="sidebar">
              {hasProfile ? (
                /* Returning user: always show DashboardPanel */
                <DashboardPanel
                  profileInputs={profileInputs}
                  refineInputs={refineInputs}
                  onRefineChange={handleRefineChange}
                  onUpdatePlan={handleRefineUpdate}
                  disabled={loading || isRefineUpdating}
                  onEditProfile={() => setShowEditProfile(true)}
                />
              ) : (
                /* New user: show onboarding once */
                <>
                  {showFullForm ? (
                    <>
                      <div style={{ marginBottom: 'var(--space-5)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                          <h2 className="section-label">Your Profile</h2>
                          <button
                            type="button"
                            onClick={() => setShowFullForm(false)}
                            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 11, cursor: 'pointer', textDecoration: 'underline' }}
                          >
                            ← Step-by-step
                          </button>
                        </div>
                        <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                          Tell us where you are. We'll surface options that fit.
                        </p>
                      </div>
                      <InputForm onSubmit={handleFirstSetup} disabled={loading} />
                    </>
                  ) : (
                    <OnboardingFlow
                      onSubmit={handleFirstSetup}
                      disabled={loading}
                      onShowFullForm={() => setShowFullForm(true)}
                    />
                  )}
                </>
              )}
            </div>

            <div>
              {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}
              {loading && <LoadingState />}
              {cards && !loading && (
                <StockGrid
                  cards={cards}
                  inputs={lastInputs}
                  advisorNarrative={advisorNarrative}
                  treasuryRates={treasuryRates}
                  user={user}
                  token={token}
                  onSignInClick={() => setShowAuthModal(true)}
                  planIsSaved={planIsSaved}
                  onSavePlanSuccess={() => setPlanIsSaved(true)}
                  portfolioTickers={portfolioTickers}
                  onAddToPortfolio={handleAddToPortfolio}
                  planUpdatedAt={planUpdatedAt}
                  onRefreshPlan={handleRefreshPlan}
                />
              )}
              {!loading && !error && !cards && (
                <div style={{ padding: 'var(--space-8)', display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
                  <h2 style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: 28, lineHeight: 1.3, fontWeight: 400 }}>
                    {hasProfile ? 'Generate your plan' : 'Explore options that fit where you are'}
                  </h2>
                  {hasProfile ? (
                    <>
                      <p style={{ fontSize: 14, color: 'var(--text-muted)', maxWidth: 420, lineHeight: 1.6 }}>
                        Your profile is set up. Click below to generate your personalised stock suggestions.
                      </p>
                      <button
                        type="button"
                        onClick={handleRefreshPlan}
                        className="btn-primary"
                        style={{ alignSelf: 'flex-start', padding: '10px 20px' }}
                      >
                        Generate My Plan →
                      </button>
                    </>
                  ) : (
                    <>
                      <p style={{ fontSize: 14, color: 'var(--text-muted)', maxWidth: 420, lineHeight: 1.6 }}>
                        Tell us your risk tolerance, how long you want to hold, and what sectors interest you. We'll suggest stocks, ETFs, REITs, and bond funds that fit your profile — and explain why each one makes sense.
                      </p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
                        {[
                          'Stocks, ETFs, REITs, and bond funds — matched to your profile',
                          'Real market prices pulled live',
                          'Plain-English explanations — no jargon',
                        ].map((text) => (
                          <div key={text} style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)' }}>
                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-green)', marginTop: 6, flexShrink: 0 }} />
                            <span style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{text}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Forecast Page */}
        {currentPage === 'forecast' && (
          <div className="layout-grid" style={{ gridTemplateColumns: '320px 1fr' }}>
            <div className="sidebar">
              <h2 className="section-label" style={{ marginBottom: 'var(--space-5)' }}>Stock Forecast</h2>
              <ForecastForm onSubmit={handleForecast} disabled={forecastLoading} />
              {forecast && forecastQuote && forecast.bull?.priceTargetRange && forecast.bear?.downsideScenario && (
                <div style={{ marginTop: 'var(--space-5)' }}>
                  <ForecastChart
                    currentPrice={forecastQuote.price}
                    bullMid={Math.round((forecast.bull.priceTargetRange.low + forecast.bull.priceTargetRange.high) / 2)}
                    bearMid={Math.round((forecast.bear.downsideScenario.low + forecast.bear.downsideScenario.high) / 2)}
                  />
                </div>
              )}
            </div>

            <div>
              {forecastError && <ErrorBanner message={forecastError} onDismiss={() => setForecastError(null)} />}
              {forecastLoading && <ForecastLoadingState ticker={forecastSearchTicker} onStep4Active={handleAnimationReady} />}
              {forecast && !forecastLoading && (
                <ForecastResult
                  forecast={forecast}
                  ticker={forecastTicker}
                  companyName={forecastCompanyName}
                  quote={forecastQuote}
                  stockPE={forecastStockPE}
                  sectorAvgPE={forecastSectorPE}
                />
              )}
              {!forecastLoading && !forecastError && !forecast && (
                <div style={{ padding: 'var(--space-8)', display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
                  <h2 style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: 28, lineHeight: 1.3, fontWeight: 400 }}>
                    Enter a ticker to build your forecast
                  </h2>
                  <p style={{ fontSize: 14, color: 'var(--text-muted)', maxWidth: 420, lineHeight: 1.6 }}>
                    We pull live market data, run two valuation models, and generate a plain-English bull and bear case — in about 15 seconds.
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
                    {[
                      'Live market data from Finnhub — price, earnings, margins, and more',
                      'Two valuation models calculated before the AI sees anything',
                      "Historical analog scenarios from this stock's real past",
                    ].map((text) => (
                      <div key={text} style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)' }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-green)', marginTop: 6, flexShrink: 0 }} />
                        <span style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Portfolio Page */}
        {currentPage === 'portfolio' && token && (
          <PortfolioPage
            token={token}
            suggestionCards={cards}
            onPortfolioChange={setPortfolioTickers}
          />
        )}

      </div>
    </div>
  );
}
