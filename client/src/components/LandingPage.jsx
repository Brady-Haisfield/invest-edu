export default function LandingPage({ onRegister, onSignIn }) {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 'var(--space-8) var(--space-6)',
    }}>

      {/* ── HERO ──────────────────────────────────────────────── */}
      <div style={{ textAlign: 'center', maxWidth: 580, width: '100%', marginBottom: 'var(--space-10)' }}>

        {/* Logo */}
        <div style={{ marginBottom: 'var(--space-5)' }}>
          <span style={{
            fontFamily: "'DM Sans', sans-serif", fontWeight: 700,
            fontSize: 32, color: 'var(--text-primary)',
          }}>M</span>
          <em style={{
            fontFamily: "'Instrument Serif', Georgia, serif",
            fontStyle: 'italic', fontSize: 32, color: 'var(--text-primary)',
          }}>eridian</em>
        </div>

        {/* Headline */}
        <h1 style={{
          fontFamily: "'Instrument Serif', Georgia, serif",
          fontSize: 42, fontWeight: 400, lineHeight: 1.2,
          color: 'var(--text-primary)', margin: '0 0 var(--space-4)',
        }}>
          Your personal wealth manager —<br />
          <em style={{ color: 'var(--accent-green-bright)' }}>for everyone.</em>
        </h1>

        {/* Subtext */}
        <p style={{
          fontSize: 16, color: 'var(--text-muted)',
          lineHeight: 1.7, margin: '0 0 var(--space-7)',
          maxWidth: 460, marginLeft: 'auto', marginRight: 'auto',
        }}>
          Tell us about your financial life. We'll surface personalized investment options,
          explain the tradeoffs, and help you build a plan that fits you.
        </p>

        {/* CTA Buttons */}
        <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={onRegister}
            style={{
              padding: '13px 28px',
              background: 'var(--accent-green)',
              border: 'none', borderRadius: 'var(--radius)',
              color: '#000', fontSize: 14, fontWeight: 700,
              cursor: 'pointer', fontFamily: "'DM Mono', monospace",
              transition: 'opacity 0.15s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = '0.88'}
            onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
          >
            Create Free Account
          </button>
          <button
            type="button"
            onClick={onSignIn}
            style={{
              padding: '13px 28px',
              background: 'none',
              border: '1px solid var(--border-2)', borderRadius: 'var(--radius)',
              color: 'var(--text-secondary)', fontSize: 14, fontWeight: 600,
              cursor: 'pointer', fontFamily: "'DM Mono', monospace",
              transition: 'border-color 0.15s, color 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent-green)'; e.currentTarget.style.color = 'var(--accent-green-bright)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-2)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
          >
            Sign In
          </button>
        </div>
      </div>

      {/* ── FEATURE HIGHLIGHTS ────────────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 'var(--space-4)',
        width: '100%',
        maxWidth: 700,
        marginBottom: 'var(--space-10)',
      }}>
        {[
          {
            title: 'Personalized to your life',
            body: 'Not just risk tolerance. Your age, income, family, goals, and timeline all shape your plan.',
          },
          {
            title: 'Every type of investment',
            body: 'Stocks, ETFs, REITs, bond funds, and more — with plain-English explanations of each.',
          },
          {
            title: 'Built-in retirement lens',
            body: 'Income potential, volatility, liquidity, and complexity ratings on every suggestion.',
          },
        ].map(({ title, body }) => (
          <div
            key={title}
            style={{
              padding: 'var(--space-5)',
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
            }}
          >
            <div style={{
              width: 6, height: 6, borderRadius: '50%',
              background: 'var(--accent-green)',
              marginBottom: 'var(--space-3)',
            }} />
            <div style={{
              fontSize: 13, fontWeight: 600, color: 'var(--text-primary)',
              marginBottom: 'var(--space-2)', lineHeight: 1.3,
            }}>
              {title}
            </div>
            <div style={{
              fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6,
            }}>
              {body}
            </div>
          </div>
        ))}
      </div>

      {/* ── BOTTOM ────────────────────────────────────────────── */}
      <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        <button
          type="button"
          onClick={onSignIn}
          style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
            fontSize: 12, color: 'var(--text-muted)',
            fontFamily: "'DM Mono', monospace",
          }}
        >
          Already have an account? <span style={{ color: 'var(--accent-green-bright)' }}>Sign in →</span>
        </button>
        <p style={{
          fontSize: 10, color: 'var(--text-muted)',
          fontFamily: "'DM Mono', monospace", margin: 0,
          textTransform: 'uppercase', letterSpacing: '0.06em',
        }}>
          Educational only — not financial advice
        </p>
      </div>

    </div>
  );
}
