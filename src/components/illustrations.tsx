/* Illustrated empty-state marks. Jewelzz vocabulary: 1.5px ink stroke
 * (`currentColor` resolves to `--border-strong`), a single `--accent` gold
 * detail, 72×72 viewBox, no fills except the gold accent. Same mood as the
 * LogoMark J-scale so the set feels like family.
 */

type IllustrationProps = {
  size?: number;
  className?: string;
};

type SvgProps = IllustrationProps & { children: React.ReactNode };

function Svg({ size = 72, className, children }: SvgProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 72 72"
      fill="none"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {children}
    </svg>
  );
}

/* ───────── Empty case — a jewellery display tray with ring slots.
 * Three slots; the middle one holds the memory of a gold ring. */
export function EmptyCaseMark(p: IllustrationProps) {
  return (
    <Svg {...p}>
      <rect x="10" y="28" width="52" height="26" rx="4" stroke="currentColor" />
      <line x1="10" y1="34" x2="62" y2="34" stroke="currentColor" opacity="0.5" />
      <circle cx="22" cy="43" r="4" stroke="currentColor" />
      <circle cx="36" cy="43" r="4" stroke="currentColor" />
      <circle cx="50" cy="43" r="4" stroke="currentColor" />
      {/* the gem that remembers yesterday's ring */}
      <circle cx="36" cy="43" r="1.6" fill="var(--accent)" />
      {/* case legs */}
      <line x1="16" y1="54" x2="16" y2="58" stroke="currentColor" />
      <line x1="56" y1="54" x2="56" y2="58" stroke="currentColor" />
    </Svg>
  );
}

/* ───────── Quiet till — ledger open on the counter, pen laid across.
 * No new entries today — the ink hasn't moved yet. */
export function QuietTillMark(p: IllustrationProps) {
  return (
    <Svg {...p}>
      {/* two pages hinged at centre */}
      <path d="M 10 50 Q 10 20 36 22 Q 62 20 62 50 Q 36 48 10 50 Z" stroke="currentColor" />
      <line x1="36" y1="22" x2="36" y2="50" stroke="currentColor" opacity="0.5" />
      {/* ruled lines, left page */}
      <line x1="16" y1="30" x2="32" y2="30" stroke="currentColor" opacity="0.3" />
      <line x1="16" y1="36" x2="32" y2="36" stroke="currentColor" opacity="0.3" />
      <line x1="16" y1="42" x2="32" y2="42" stroke="currentColor" opacity="0.3" />
      {/* pen laid diagonally — gold tip */}
      <line x1="22" y1="16" x2="46" y2="38" stroke="currentColor" />
      <line x1="44" y1="36" x2="47" y2="39" stroke="var(--accent)" strokeWidth="2.4" />
    </Svg>
  );
}

/* ───────── Still scale — balance resting empty, one gold gem in a pan.
 * The weighing hasn't begun. */
export function StillScaleMark(p: IllustrationProps) {
  return (
    <Svg {...p}>
      {/* beam */}
      <line x1="12" y1="22" x2="60" y2="22" stroke="currentColor" />
      {/* post */}
      <line x1="36" y1="22" x2="36" y2="52" stroke="currentColor" />
      {/* base */}
      <path d="M 24 56 L 48 56 L 42 52 L 30 52 Z" stroke="currentColor" />
      {/* suspension strings */}
      <line x1="18" y1="22" x2="18" y2="32" stroke="currentColor" />
      <line x1="54" y1="22" x2="54" y2="32" stroke="currentColor" />
      {/* pans */}
      <path d="M 10 32 Q 18 42 26 32" stroke="currentColor" />
      <path d="M 46 32 Q 54 42 62 32" stroke="currentColor" />
      {/* a single gem resting */}
      <circle cx="18" cy="34" r="1.8" fill="var(--accent)" />
    </Svg>
  );
}

/* ───────── Open shop — storefront window with a hanging "open" tag.
 * Door's unlocked, no one's walked in yet. */
export function OpenShopMark(p: IllustrationProps) {
  return (
    <Svg {...p}>
      {/* storefront outline */}
      <path d="M 10 54 L 10 24 L 36 14 L 62 24 L 62 54 Z" stroke="currentColor" />
      {/* door */}
      <rect x="28" y="34" width="16" height="20" stroke="currentColor" />
      {/* door handle */}
      <circle cx="40" cy="44" r="0.8" fill="currentColor" />
      {/* OPEN tag hanging — small gold rectangle */}
      <line x1="22" y1="30" x2="22" y2="36" stroke="currentColor" opacity="0.5" />
      <rect x="18" y="36" width="8" height="5" rx="1" fill="var(--accent)" stroke="var(--accent)" />
    </Svg>
  );
}

/* ───────── Blank ledger — a single page, ruled, waiting for the first entry.
 * Top rule is gold — the keyline. */
export function BlankLedgerMark(p: IllustrationProps) {
  return (
    <Svg {...p}>
      <rect x="14" y="12" width="44" height="48" rx="2" stroke="currentColor" />
      {/* gold header rule */}
      <line x1="20" y1="20" x2="52" y2="20" stroke="var(--accent)" strokeWidth="1.6" />
      {/* ruled lines */}
      <line x1="20" y1="28" x2="52" y2="28" stroke="currentColor" opacity="0.3" />
      <line x1="20" y1="34" x2="52" y2="34" stroke="currentColor" opacity="0.3" />
      <line x1="20" y1="40" x2="52" y2="40" stroke="currentColor" opacity="0.3" />
      <line x1="20" y1="46" x2="52" y2="46" stroke="currentColor" opacity="0.3" />
      <line x1="20" y1="52" x2="52" y2="52" stroke="currentColor" opacity="0.3" />
    </Svg>
  );
}

/* ───────── Counter bell — brass bell on the counter, un-rung.
 * No customer has yet asked for service. Doubles as a nod to the Bell overlay. */
export function CounterBellMark(p: IllustrationProps) {
  return (
    <Svg {...p}>
      {/* bell dome */}
      <path d="M 20 46 Q 20 24 36 24 Q 52 24 52 46 Z" stroke="currentColor" />
      {/* base plate */}
      <line x1="16" y1="48" x2="56" y2="48" stroke="currentColor" strokeWidth="1.6" />
      {/* mini feet */}
      <line x1="22" y1="48" x2="22" y2="52" stroke="currentColor" />
      <line x1="50" y1="48" x2="50" y2="52" stroke="currentColor" />
      {/* top button — gold */}
      <circle cx="36" cy="24" r="2.6" fill="var(--accent)" />
      <line x1="36" y1="21.4" x2="36" y2="18" stroke="var(--accent)" />
    </Svg>
  );
}

/* ───────── Balanced — both pans at the same height, a gold tie-ribbon
 * knotted over the beam. The "all settled" state: ledger closed, nothing
 * owed either way. */
export function BalancedMark(p: IllustrationProps) {
  return (
    <Svg {...p}>
      {/* beam */}
      <line x1="12" y1="30" x2="60" y2="30" stroke="currentColor" />
      {/* post */}
      <line x1="36" y1="30" x2="36" y2="54" stroke="currentColor" />
      {/* base */}
      <path d="M 24 58 L 48 58 L 42 54 L 30 54 Z" stroke="currentColor" />
      {/* suspension strings — short, pans at matching height */}
      <line x1="18" y1="30" x2="18" y2="36" stroke="currentColor" />
      <line x1="54" y1="30" x2="54" y2="36" stroke="currentColor" />
      {/* pans — level */}
      <path d="M 10 36 Q 18 44 26 36" stroke="currentColor" />
      <path d="M 46 36 Q 54 44 62 36" stroke="currentColor" />
      {/* the knotted gold ribbon tied over the beam — the "sealed" tie */}
      <path d="M 32 22 Q 36 18 40 22 Q 36 28 32 22 Z" fill="var(--accent)" stroke="var(--accent)" />
      <line x1="36" y1="24" x2="36" y2="30" stroke="var(--accent)" strokeWidth="1.2" />
    </Svg>
  );
}

/* ───────── Morning rate — a sunrise peeking over a resting scale.
 * Specifically for "set today's morning rate" moments. */
export function MorningRateMark(p: IllustrationProps) {
  return (
    <Svg {...p}>
      {/* horizon line */}
      <line x1="8" y1="46" x2="64" y2="46" stroke="currentColor" strokeWidth="1.2" />
      {/* sun — gold half-disc rising from the horizon */}
      <path d="M 22 46 A 10 10 0 0 1 42 46" fill="var(--accent)" stroke="var(--accent)" />
      {/* rays */}
      <line x1="18" y1="40" x2="14" y2="36" stroke="var(--accent)" strokeWidth="1.2" />
      <line x1="32" y1="32" x2="32" y2="26" stroke="var(--accent)" strokeWidth="1.2" />
      <line x1="46" y1="40" x2="50" y2="36" stroke="var(--accent)" strokeWidth="1.2" />
      {/* a resting scale on the right side of the horizon */}
      <line x1="52" y1="46" x2="52" y2="56" stroke="currentColor" />
      <path d="M 46 58 L 58 58 L 55 56 L 49 56 Z" stroke="currentColor" />
      <line x1="48" y1="46" x2="56" y2="46" stroke="currentColor" />
    </Svg>
  );
}

/* ───────── Silent counter — closed shutter with a hanging gold tag.
 * For "no bills today" moments on the home / dev / reports screens. */
export function SilentCounterMark(p: IllustrationProps) {
  return (
    <Svg {...p}>
      {/* shutter frame */}
      <rect x="10" y="12" width="52" height="42" rx="2" stroke="currentColor" />
      {/* horizontal shutter slats */}
      <line x1="14" y1="20" x2="58" y2="20" stroke="currentColor" opacity="0.4" />
      <line x1="14" y1="26" x2="58" y2="26" stroke="currentColor" opacity="0.4" />
      <line x1="14" y1="32" x2="58" y2="32" stroke="currentColor" opacity="0.4" />
      <line x1="14" y1="38" x2="58" y2="38" stroke="currentColor" opacity="0.4" />
      <line x1="14" y1="44" x2="58" y2="44" stroke="currentColor" opacity="0.4" />
      {/* bottom bar — the counter */}
      <line x1="10" y1="54" x2="62" y2="54" stroke="currentColor" strokeWidth="1.6" />
      {/* hanging gold tag at centre */}
      <line x1="36" y1="12" x2="36" y2="18" stroke="currentColor" opacity="0.5" />
      <rect x="30" y="18" width="12" height="7" rx="1" fill="var(--accent)" stroke="var(--accent)" />
    </Svg>
  );
}

/* Convenience key → component mapping for the Empty primitive. */
export const EMPTY_MARKS = {
  case:     EmptyCaseMark,
  till:     QuietTillMark,
  scale:    StillScaleMark,
  shop:     OpenShopMark,
  ledger:   BlankLedgerMark,
  bell:     CounterBellMark,
  balanced: BalancedMark,
  morning:  MorningRateMark,
  silent:   SilentCounterMark,
} as const;

export type EmptyMarkKey = keyof typeof EMPTY_MARKS;
