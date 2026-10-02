// The Weighing — Jewelzz's signature animation. Fires on the emotional beat
// (sale-post success). A mini J-scale renders in place, the gold gem drops from
// above onto the pan, and the beam tilts under the weight before settling.
// Silent by default; muted by prefers-reduced-motion (see index.css).

/**
 * The Weighing. Two modes:
 *   - default ('once'): fires on sale-post success — see SaleScreen.
 *   - 'ambient': slow 6s loop for the HomeScreen — a signature moment on
 *     the Today screen the owner sees each morning.
 */
export function Weighing({ size = 56, mode = 'once' }: { size?: number; mode?: 'once' | 'ambient' }) {
  const scaleClass = mode === 'ambient' ? 'weigh-scale-ambient' : 'weigh-scale';
  const gemClass = mode === 'ambient' ? 'weigh-gem-ambient' : 'weigh-gem';
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      fill="none"
      aria-hidden="true"
      style={{ overflow: 'visible' }}
    >
      {/* J-hook + suspension — anchor points, don't move */}
      <path
        d="M 10 5 Q 10 10 16 10 Q 22 10 22 5"
        stroke="var(--ink-950)"
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
      />
      <line
        x1="16" y1="10" x2="16" y2="17.5"
        stroke="var(--ink-950)"
        strokeWidth="1"
        strokeLinecap="round"
      />

      {/* Beam + pan + gem — the group that tilts as the weight lands */}
      <g className={scaleClass}>
        <line
          x1="7" y1="18.5" x2="25" y2="18.5"
          stroke="var(--ink-950)"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <path
          d="M 7 18.5 Q 16 26.5 25 18.5"
          stroke="var(--ink-950)"
          strokeWidth="1.6"
          strokeLinecap="round"
          fill="none"
        />

        {/* The gem drops in independently — this is the object being weighed */}
        <circle
          className={gemClass}
          cx="16" cy="20.5" r="1.9"
          fill="var(--gold-500)"
        />
      </g>
    </svg>
  );
}
