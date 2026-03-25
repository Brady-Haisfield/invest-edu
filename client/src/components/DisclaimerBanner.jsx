export default function DisclaimerBanner() {
  return (
    <div className="disclaimer-bar">
      <span className="mono" style={{ fontSize: 11, color: 'var(--accent-amber)', whiteSpace: 'nowrap' }}>
        NOTICE —
      </span>
      <span style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
        All content is AI-generated for educational purposes only. Not financial advice. Consult a licensed advisor before investing.
      </span>
    </div>
  );
}
