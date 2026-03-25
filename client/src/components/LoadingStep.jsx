export default function LoadingStep({ status, text }) {
  const textColor =
    status === 'done' ? 'var(--text-muted)' :
    status === 'active' ? 'var(--text-primary)' :
    'var(--text-muted)';

  return (
    <div className="loading-step">
      <div className={`loading-dot loading-dot--${status}`} />
      <span style={{ fontSize: 12, color: textColor }}>{text}</span>
    </div>
  );
}
