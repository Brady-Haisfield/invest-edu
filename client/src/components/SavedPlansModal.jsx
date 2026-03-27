import { useState, useEffect } from 'react';
import { getSavedPlans, deletePlan } from '../services/auth.js';

const OVERLAY = {
  position: 'fixed', inset: 0, zIndex: 200,
  background: 'rgba(0,0,0,0.7)',
  backdropFilter: 'blur(4px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: 'var(--space-4)',
};

const CARD = {
  width: '100%', maxWidth: 520,
  background: 'var(--bg-card)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-lg)',
  padding: 'var(--space-6)',
  maxHeight: '80vh',
  display: 'flex', flexDirection: 'column',
};

export default function SavedPlansModal({ token, onClose, onLoad }) {
  const [plans, setPlans]             = useState([]);
  const [loading, setLoading]         = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting]       = useState(false);

  useEffect(() => {
    getSavedPlans(token)
      .then((data) => setPlans(data.plans ?? []))
      .catch(() => setPlans([]))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleDelete(planId) {
    setDeleting(true);
    try {
      await deletePlan(token, planId);
      setPlans((prev) => prev.filter((p) => p.id !== planId));
      setConfirmDelete(null);
    } catch {
      // silently ignore
    } finally {
      setDeleting(false);
    }
  }

  function formatDate(str) {
    try {
      return new Date(str).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return str;
    }
  }

  return (
    <div style={OVERLAY} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={CARD}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-5)', flexShrink: 0 }}>
          <span className="section-label">Saved Plans</span>
          <button
            type="button" onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 16, cursor: 'pointer', padding: '2px 4px', lineHeight: 1 }}
          >✕</button>
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {loading && (
            <p style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: "'DM Mono', monospace", textAlign: 'center', padding: 'var(--space-6) 0' }}>
              Loading...
            </p>
          )}

          {!loading && plans.length === 0 && (
            <div style={{ textAlign: 'center', padding: 'var(--space-8) var(--space-4)' }}>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, margin: 0 }}>
                No saved plans yet. Run a search and save your first plan.
              </p>
            </div>
          )}

          {!loading && plans.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {plans.map((plan) => (
                <div
                  key={plan.id}
                  style={{
                    padding: 'var(--space-4)',
                    background: 'var(--bg)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-3)' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 3 }}>
                        {plan.planName}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: "'DM Mono', monospace" }}>
                        {formatDate(plan.createdAt)}
                        {plan.cards?.length ? ` · ${plan.cards.length} securities` : ''}
                        {plan.inputs?.amount ? ` · $${Number(plan.inputs.amount).toLocaleString()}` : ''}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 'var(--space-2)', flexShrink: 0 }}>
                      <button
                        type="button"
                        onClick={() => { onLoad(plan); onClose(); }}
                        style={{
                          padding: '5px 12px',
                          background: 'var(--accent-green-dim)', border: '1px solid var(--accent-green)',
                          borderRadius: 'var(--radius-sm)', color: 'var(--accent-green-bright)',
                          fontSize: 11, cursor: 'pointer', fontFamily: "'DM Mono', monospace",
                        }}
                      >Load</button>

                      {confirmDelete === plan.id ? (
                        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                          <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: "'DM Mono', monospace" }}>Sure?</span>
                          <button
                            type="button"
                            onClick={() => handleDelete(plan.id)}
                            disabled={deleting}
                            style={{
                              padding: '4px 8px',
                              background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)',
                              borderRadius: 'var(--radius-sm)', color: 'var(--accent-red)',
                              fontSize: 10, cursor: 'pointer', fontFamily: "'DM Mono', monospace",
                            }}
                          >Yes</button>
                          <button
                            type="button"
                            onClick={() => setConfirmDelete(null)}
                            style={{
                              padding: '4px 8px',
                              background: 'var(--bg-input)', border: '1px solid var(--border)',
                              borderRadius: 'var(--radius-sm)', color: 'var(--text-muted)',
                              fontSize: 10, cursor: 'pointer', fontFamily: "'DM Mono', monospace",
                            }}
                          >No</button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDelete(plan.id)}
                          style={{
                            padding: '5px 10px',
                            background: 'none', border: '1px solid var(--border)',
                            borderRadius: 'var(--radius-sm)', color: 'var(--text-muted)',
                            fontSize: 11, cursor: 'pointer', fontFamily: "'DM Mono', monospace",
                          }}
                        >Delete</button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
