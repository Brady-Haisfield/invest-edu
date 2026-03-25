import { useState, useEffect } from 'react';
import LoadingStep from './LoadingStep.jsx';

export default function ForecastLoadingState({ ticker = '', onStep4Active }) {
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setCurrentStep(1), 2000);
    const t2 = setTimeout(() => setCurrentStep(2), 4000);
    const t3 = setTimeout(() => setCurrentStep(3), 6000);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  useEffect(() => {
    if (currentStep === 3) onStep4Active?.();
  }, [currentStep]);

  function status(idx) {
    if (idx < currentStep) return 'done';
    if (idx === currentStep) return 'active';
    return 'pending';
  }

  return (
    <div className="loading-card">
      <h2 style={{ fontSize: 20, marginBottom: 6 }}>Building your forecast</h2>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 'var(--space-6)' }}>
        This usually takes 10–15 seconds
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
        <LoadingStep status={status(0)} text={`Fetching ${ticker} market data`} />
        <LoadingStep status={status(1)} text="Analyzing financials" />
        <LoadingStep status={status(2)} text="Researching historical scenarios" />
        <LoadingStep status={status(3)} text="Writing your forecast" />
      </div>

      <div className="progress-bar-track">
        <div className="progress-bar-fill" />
      </div>
    </div>
  );
}
