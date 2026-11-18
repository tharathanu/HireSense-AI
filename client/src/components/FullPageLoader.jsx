import { LogoMark } from './Logo';

export default function FullPageLoader({ text = 'Loading your workspace…' }) {
  return (
    <div
      role="status"
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        color: 'var(--text-muted)',
      }}
    >
      <LogoMark size={48} />
      <span>{text}</span>
    </div>
  );
}
