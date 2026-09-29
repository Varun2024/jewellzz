// Jewelzz brand: J-shaped scale hook, single hanging pan, one gold gem.
// Reads as jewellery scale AND our initial J. Ownable and works at 16px.

type Props = {
  size?: number;
  // 'ink' = default (ink on paper), 'gold' = full gold, 'reverse' = paper on ink
  variant?: 'ink' | 'gold' | 'reverse';
  className?: string;
};

export function LogoMark({ size = 24, variant = 'ink', className }: Props) {
  const stroke = variant === 'reverse' ? 'var(--paper)' : variant === 'gold' ? 'var(--gold-700)' : 'var(--ink-950)';
  const gem = variant === 'reverse' ? 'var(--gold-500)' : 'var(--gold-500)';
  return (
    <svg
      viewBox="0 0 32 32"
      width={size} height={size}
      className={className}
      fill="none"
      aria-hidden="true"
    >
      {/* J-hook — the serif crown of a Fraunces italic J, doubles as suspension */}
      <path
        d="M 10 5 Q 10 10 16 10 Q 22 10 22 5"
        stroke={stroke}
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
      />
      {/* suspension line */}
      <line x1="16" y1="10" x2="16" y2="17.5" stroke={stroke} strokeWidth="1" strokeLinecap="round" />
      {/* beam */}
      <line x1="7" y1="18.5" x2="25" y2="18.5" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" />
      {/* pan — shallow crescent below */}
      <path
        d="M 7 18.5 Q 16 26.5 25 18.5"
        stroke={stroke}
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
      />
      {/* gem sitting in the pan */}
      <circle cx="16" cy="20.5" r="1.9" fill={gem} />
    </svg>
  );
}

export function Wordmark({ size = 22, variant = 'ink', className }: Props) {
  const color = variant === 'reverse' ? 'var(--paper)' : variant === 'gold' ? 'var(--gold-700)' : 'var(--ink-950)';
  return (
    <span
      className={className}
      style={{
        fontFamily: 'var(--font-display)',
        fontStyle: 'italic',
        fontWeight: 500,
        fontSize: size,
        letterSpacing: '-0.015em',
        color,
        lineHeight: 1,
      }}
    >
      jewelzz
    </span>
  );
}

// Full lockup: mark + wordmark + a small gold hairline separating them at scale.
export function Logo({ size = 20, variant = 'ink', className }: Props) {
  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ''}`}>
      <LogoMark size={size + 8} variant={variant} />
      <Wordmark size={size + 2} variant={variant} />
    </span>
  );
}
