// HireSense AI logo: an "H" whose crossbar rises like a progress line
export function LogoMark({ size = 36, inverted = false }) {
  const tile = inverted ? '#FFFFFF' : '#14213D';
  const bars = inverted ? '#14213D' : '#F7F7F4';
  const line = inverted ? '#0F766E' : '#2DD4BF';
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="14" fill={tile} />
      <rect x="16" y="14" width="7" height="36" rx="2" fill={bars} />
      <rect x="41" y="14" width="7" height="36" rx="2" fill={bars} />
      <polyline
        points="19,38 28,38 34,28 44,28"
        fill="none"
        stroke={line}
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function Logo({ size = 36, light = false }) {
  return (
    <span className="logo" style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
      <LogoMark size={size} inverted={light} />
      <span
        style={{
          fontWeight: 700,
          fontSize: size * 0.56,
          letterSpacing: '-0.02em',
          color: light ? '#FFFFFF' : '#14213D',
        }}
      >
        HireSense<span style={{ color: light ? '#2DD4BF' : '#0F766E' }}> AI</span>
      </span>
    </span>
  );
}
