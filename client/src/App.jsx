import { useState, useRef, useEffect } from 'react';
import { fetchSuggestions, fetchMarketRates } from './api/suggestions.js';
import { fetchForecast } from './api/forecast.js';
import { getMe, saveProfile } from './services/auth.js';
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
  const takeHome  = Number(r.monthlyTakeHome) || 0;
  const pension   = (r.hasPension === 'yes') ? (Number(r.pensionAmount) || 0) : 0;
  const ss        = Number(r.expectedSocialSecurity) || 0;
  const expenses  = Number(r.monthlyExpenses) || 0;
  const debt      = Number(r.monthlyDebt) || 0;
  const totalIncome = takeHome + pension + ss;
  const showSurplus = r.monthlyTakeHome !== '' || r.monthlyExpenses !== '' || (r.hasPension === 'yes' && r.pensionAmount !== '') || r.expectedSocialSecurity !== '';
  return {
    ...profileInputs,
    numChildren:             r.numChildren !== '' ? Number(r.numChildren) : null,
    childrenAges:            r.childrenAges || null,
    monthlyDependentCosts:   r.monthlyDependentCosts !== '' ? Number(r.monthlyDependentCosts) : null,
    supportingAgingParents:  r.supportingAgingParents || null,
    totalSavings:            r.totalSavings !== '' ? Number(r.totalSavings) : null,
    liquidityFloor:          r.liquidityFloor !== '' ? Number(r.liquidityFloor) : null,
    monthlyTakeHome:         r.monthlyTakeHome !== '' ? Number(r.monthlyTakeHome) : null,
    monthlyExpenses:         r.monthlyExpenses !== '' ? Number(r.monthlyExpenses) : null,
    monthlySurplus:          showSurplus ? (totalIncome - expenses - debt) : null,
    hasPension:              r.hasPension || null,
    pensionAmount:           r.pensionAmount !== '' ? Number(r.pensionAmount) : null,
    expectedSocialSecurity:  r.expectedSocialSecurity !== '' ? Number(r.expectedSocialSecurity) : null,
    targetRetirementAge:     r.targetRetirementAge !== '' ? Number(r.targetRetirementAge) : null,
    monthlyDebt:             r.monthlyDebt !== '' ? Number(r.monthlyDebt) : null,
    homeownership:           r.homeownership || profileInputs?.homeownership || null,
    investmentExperience:    r.investmentExperience || null,
    allocStocks:             r.allocStocks !== '' ? Number(r.allocStocks) : null,
    allocBonds:              r.allocBonds  !== '' ? Number(r.allocBonds)  : null,
    allocCash:               r.allocCash   !== '' ? Number(r.allocCash)   : null,
    allocRealEstate:         r.allocRealEstate !== '' ? Number(r.allocRealEstate) : null,
  };
}

export default function App() {
  const [currentPage, setCurrentPage] = useState('home');

  // Auth state
  const [user, setUser]                   = useState(null);
  const [token, setToken]                 = useState(null);
  const [authChecked, setAuthChecked]     = useState(false);
  const [authModalTab, setAuthModalTab]   = useState('signin');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showSavedPlans, setShowSavedPlans] = useState(false);
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

  // Auto-fetch on initial load when profile exists but no cards were cached in DB
  useEffect(() => {
    if (!authChecked || !hasProfile || cards !== null) return;
    const merged = buildMergedInputs(profileRef.current, refineRef.current);
    if (!merged) return;
    setLoading(true);
    setError(null);
    setTreasuryRates(null);
    setLastInputs(merged);
    fetchSuggestions(merged)
      .then(({ cards: c, advisorNarrative: n, treasuryRates: r }) => {
        setCards(c);
        setAdvisorNarrative(n);
        setTreasuryRates(r);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [authChecked, hasProfile]); // eslint-disable-line react-hooks/exhaustive-deps

  // Restore auth from localStorage on mount and verify token
  useEffect(() => {
    const savedToken = localStorage.getItem('meridian_token');
    const savedUser  = localStorage.getItem('meridian_user');
    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
      getMe(savedToken)
        .then((meData) => {
          console.log('[mount] getMe response:', JSON.stringify({
            hasProfile: !!meData.savedProfile,
            hasInputs: !!meData.savedProfile?.inputs,
            hasCards: !!meData.savedProfile?.lastCards,
            cardCount: meData.savedProfile?.lastCards?.length ?? 0,
          }));
          if (meData.savedProfile) {
            const { inputs, refineInputs: savedRefine, lastCards, lastAdvisorNarrative } = meData.savedProfile;
            setProfileInputs(inputs);
            setHasProfile(true);
            if (savedRefine) setRefineInputs(savedRefine);
            if (lastCards) {
              setCards(lastCards);
              setLastInputs(buildMergedInputs(inputs, savedRefine));
              setAdvisorNarrative(lastAdvisorNarrative ?? null);
              setPlanIsSaved(true);
              console.log('[mount] restored', lastCards.length, 'cards from DB ✓');
              // Fetch live market rates independently — not bundled with cached cards
              fetchMarketRates().then((rates) => {
                console.log('[mount] fetchMarketRates result:', rates);
                if (rates) setTreasuryRates(rates);
              });
            } else {
              console.log('[mount] profile found but no cached cards — will auto-fetch');
            }
          } else {
            console.log('[mount] no saved profile — showing onboarding');
          }
        })
        .catch((err) => {
          console.error('[mount] getMe failed:', err.message);
          localStorage.removeItem('meridian_token');
          localStorage.removeItem('meridian_user');
          setToken(null);
          setUser(null);
        })
        .finally(() => setAuthChecked(true));
    } else {
      setAuthChecked(true);
    }
  }, []);

  // Auto-clear toast after 3 seconds
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);


  async function handleAuthSuccess(authUser, authToken) {
    setUser(authUser);
    setToken(authToken);
    setShowAuthModal(false);
    try {
      const meData = await getMe(authToken);
      if (meData.savedProfile) {
        const { inputs, refineInputs: savedRefine, lastCards, lastAdvisorNarrative } = meData.savedProfile;
        setProfileInputs(inputs);
        setHasProfile(true);
        if (savedRefine) setRefineInputs(savedRefine);
        if (lastCards) {
          setCards(lastCards);
          setLastInputs(buildMergedInputs(inputs, savedRefine));
          setAdvisorNarrative(lastAdvisorNarrative ?? null);
          setPlanIsSaved(true);
          fetchMarketRates().then((rates) => {
            if (rates) setTreasuryRates(rates);
          });
        } else {
          // No cached results — fetch fresh
          const merged = buildMergedInputs(inputs, savedRefine);
          const result = await handleSubmitCore(merged);
          if (result) {
            saveProfile(authToken, {
              inputs,
              refineInputs: savedRefine,
              lastCards: result.cards,
              lastAdvisorNarrative: result.advisorNarrative ?? null,
            }).catch(() => {});
          }
        }
      }
      // No savedProfile → user stays on onboarding (hasProfile = false)
    } catch {
      // non-critical
    }
  }

  function signOut() {
    localStorage.removeItem('meridian_token');
    localStorage.removeItem('meridian_user');
    setUser(null);
    setToken(null);
    setCards(null);
    setLastInputs(null);
    setAdvisorNarrative(null);
    setHasProfile(false);
    setProfileInputs(null);
    setRefineInputs(INITIAL_REFINE);
  }

  function handleLoadPlan(plan) {
    setCards(plan.cards);
    setLastInputs(plan.inputs);
    setAdvisorNarrative(plan.advisorNarrative ?? null);
    setTreasuryRates(null);
    setCurrentPage('home');
  }

  // Core submit — returns { cards, advisorNarrative } or null on error
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
      setCards(newCards);
      setAdvisorNarrative(narrative);
      setTreasuryRates(rates);
      return { cards: newCards, advisorNarrative: narrative };
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }

  // First-time setup: called when new user completes onboarding
  async function handleFirstSetup(formData) {
    setProfileInputs(formData);
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
      })
        .then(() => console.log('[handleFirstSetup] profile saved to DB ✓'))
        .catch((err) => console.error('[handleFirstSetup] profile save failed:', err.message));
    } else {
      console.warn('[handleFirstSetup] skipping save — result:', !!result, 'token:', !!tok);
    }
  }

  // Edit profile save
  async function handleEditProfileSave(formData) {
    setProfileInputs(formData);
    setShowEditProfile(false);
    const ri  = refineRef.current;
    const tok = tokenRef.current;
    const merged = buildMergedInputs(formData, ri);
    const result = await handleSubmitCore(merged);
    if (result && tok) {
      saveProfile(tok, {
        inputs: formData,
        refineInputs: ri,
        lastCards: result.cards,
        lastAdvisorNarrative: result.advisorNarrative ?? null,
      }).catch(() => {});
    }
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
        }).catch(() => {});
      }
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
        onNavigate={setCurrentPage}
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
                />
              )}
              {!loading && !error && !cards && (
                <div style={{ padding: 'var(--space-8)', display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
                  <h2 style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: 28, lineHeight: 1.3, fontWeight: 400 }}>
                    {hasProfile ? 'Updating your results…' : 'Explore options that fit where you are'}
                  </h2>
                  {!hasProfile && (
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

      </div>
    </div>
  );
}
