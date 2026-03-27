import OnboardingFlow from './OnboardingFlow.jsx';

const OVERLAY = {
  position: 'fixed', inset: 0, zIndex: 200,
  background: 'rgba(0,0,0,0.8)',
  backdropFilter: 'blur(4px)',
  display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
  padding: 'var(--space-6)',
  overflowY: 'auto',
};

export default function EditProfileModal({ profileInputs, onSave, onClose }) {
  return (
    <div style={OVERLAY} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{
        width: '100%', maxWidth: 420,
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-6)',
        marginTop: 'var(--space-4)',
        marginBottom: 'var(--space-4)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-5)' }}>
          <span style={{ fontSize: 13, fontFamily: "'DM Mono', monospace", color: 'var(--text-secondary)', fontWeight: 700 }}>
            Edit Profile
          </span>
          <button
            type="button" onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 16, cursor: 'pointer', padding: '2px 4px', lineHeight: 1 }}
          >✕</button>
        </div>
        <OnboardingFlow
          defaultValues={profileInputs}
          submitLabel="Save Changes →"
          onSubmit={onSave}
          disabled={false}
        />
      </div>
    </div>
  );
}
