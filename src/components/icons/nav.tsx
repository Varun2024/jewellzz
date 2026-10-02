// Jewelzz nav icon set — hand-drawn, hairline stroke, signature gold-dot motif.
// Each icon = one meaningful shape + one gold-dot signature that promotes to a filled accent
// when active. The gold dot is the through-line that ties the whole product together.

import type { ComponentType, SVGProps } from 'react';

export type NavIconProps = {
  size?: number;
  active?: boolean;
  className?: string;
};

const GOLD = 'var(--gold-500)';
const STROKE = 1.5;

function base(active: boolean): Partial<SVGProps<SVGSVGElement>> {
  return {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: STROKE,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    // active nudges the icon a hair — subtle "click in"
    style: active ? { transform: 'translateY(-0.5px)' } : undefined,
  };
}

// Home — house with a gold gem in the window (our through-line motif)
export const HomeIcon: ComponentType<NavIconProps> = ({ size = 18, active = false, className }) => (
  <svg width={size} height={size} className={className} {...base(active)}>
    <path d="M 4 11 L 12 4 L 20 11 L 20 20 L 4 20 Z" />
    <path d="M 9 20 L 9 14 L 15 14 L 15 20" strokeWidth={1.2} />
    <circle cx="12" cy="10" r={active ? 1.8 : 1.2} fill={GOLD} stroke="none" />
  </svg>
);

// Sale — receipt with torn top, ₹ mark, gold dot as our brand signature
export const SaleIcon: ComponentType<NavIconProps> = ({ size = 18, active = false, className }) => (
  <svg width={size} height={size} className={className} {...base(active)}>
    <path d="M 6 5 L 6 20 L 8 19 L 10 20 L 12 19 L 14 20 L 16 19 L 18 20 L 18 5" />
    <path d="M 6 5 L 7 4 L 9 5 L 11 4 L 13 5 L 15 4 L 17 5 L 18 5" />
    <path d="M 9 10 L 15 10 M 9 13 L 13 13" strokeWidth={1.2} />
    <circle cx="17" cy="9" r={active ? 2 : 1.4} fill={GOLD} stroke="none" />
  </svg>
);

// Purchase — bag with a J-hook handle (subtle initial motif) + down arrow entering
export const PurchaseIcon: ComponentType<NavIconProps> = ({ size = 18, active = false, className }) => (
  <svg width={size} height={size} className={className} {...base(active)}>
    <path d="M 5 9 L 5 20 L 19 20 L 19 9 Z" />
    <path d="M 8 9 C 8 5 10 4 12 4 C 14 4 16 5 16 9" />
    <path d="M 12 12 L 12 16 M 10 14 L 12 16 L 14 14" strokeWidth={1.2} />
    <circle cx="17" cy="7" r={active ? 1.8 : 1.2} fill={GOLD} stroke="none" />
  </svg>
);

// Stock — box with SKU tag corner + gold dot on the tag
export const StockIcon: ComponentType<NavIconProps> = ({ size = 18, active = false, className }) => (
  <svg width={size} height={size} className={className} {...base(active)}>
    <path d="M 4 8 L 12 4 L 20 8 L 20 17 L 12 21 L 4 17 Z" />
    <path d="M 4 8 L 12 12 L 20 8 M 12 12 L 12 21" strokeWidth={1.2} />
    <circle cx="16" cy="6.5" r={active ? 1.8 : 1.2} fill={GOLD} stroke="none" />
  </svg>
);

// Ledgers — open book with gold ribbon bookmark
export const LedgersIcon: ComponentType<NavIconProps> = ({ size = 18, active = false, className }) => (
  <svg width={size} height={size} className={className} {...base(active)}>
    <path d="M 4 5 L 4 19 L 11 20 L 12 20 L 13 20 L 20 19 L 20 5 L 13 6 L 12 6.5 L 11 6 Z" />
    <path d="M 12 6.5 L 12 20" strokeWidth={1.2} />
    <path d="M 15 4 L 15 13 L 16.5 11.5 L 18 13 L 18 4" fill={GOLD} stroke={GOLD} strokeWidth={0.8} opacity={active ? 1 : 0.55} />
  </svg>
);

// Parties — two circles (heads) with a small gold gem hovering between them
export const PartiesIcon: ComponentType<NavIconProps> = ({ size = 18, active = false, className }) => (
  <svg width={size} height={size} className={className} {...base(active)}>
    <circle cx="8" cy="9" r="3" />
    <circle cx="16" cy="9" r="3" />
    <path d="M 3 20 C 3 16 5.5 14 8 14 C 10 14 11 15 12 15 C 13 15 14 14 16 14 C 18.5 14 21 16 21 20" />
    <path d="M 12 4 L 13 6 L 12 8 L 11 6 Z" fill={GOLD} stroke="none" opacity={active ? 1 : 0.7} />
  </svg>
);

// Items — price tag with J-hook string loop + gold dot as tag hole
export const ItemsIcon: ComponentType<NavIconProps> = ({ size = 18, active = false, className }) => (
  <svg width={size} height={size} className={className} {...base(active)}>
    <path d="M 4 12 L 12 4 L 20 4 L 20 12 L 12 20 Z" />
    <path d="M 9 5 C 9 3 12 3 12 5 C 12 6.5 9 6.5 9 8" strokeWidth={1.2} opacity={0.8} />
    <circle cx="16" cy="8" r={active ? 2 : 1.4} fill={GOLD} stroke="none" />
  </svg>
);

// Catalog — stacked photo frames, top has a gold gem
export const CatalogIcon: ComponentType<NavIconProps> = ({ size = 18, active = false, className }) => (
  <svg width={size} height={size} className={className} {...base(active)}>
    <rect x="3" y="7" width="13" height="13" rx="1.5" />
    <rect x="7" y="4" width="13" height="13" rx="1.5" opacity={0.5} strokeWidth={1.2} />
    <path d="M 3 15 L 7 12 L 10 14 L 14 10 L 16 12" />
    <path d="M 13 6.5 L 14 8.5 L 13 10.5 L 12 8.5 Z" fill={GOLD} stroke="none" opacity={active ? 1 : 0.8} />
  </svg>
);

// Karigar — goldsmith's hammer with a small spark/gold dot
export const KarigarIcon: ComponentType<NavIconProps> = ({ size = 18, active = false, className }) => (
  <svg width={size} height={size} className={className} {...base(active)}>
    <path d="M 3 15 L 9 9 L 12 12 L 6 18 Z" />
    <path d="M 9 9 L 15 3 L 21 9 L 15 15 L 12 12" />
    <circle cx="20" cy="4" r={active ? 1.8 : 1.2} fill={GOLD} stroke="none" />
  </svg>
);

// Refining — circular arrow loop with a gem in the center (metal cycle)
export const RefiningIcon: ComponentType<NavIconProps> = ({ size = 18, active = false, className }) => (
  <svg width={size} height={size} className={className} {...base(active)}>
    <path d="M 20 12 A 8 8 0 1 1 6.5 6.5" />
    <path d="M 20 6 L 20 12 L 14 12" />
    <path d="M 12 9 L 14 12 L 12 15 L 10 12 Z" fill={GOLD} stroke={GOLD} strokeWidth={0.6} opacity={active ? 1 : 0.75} />
  </svg>
);

// Jobs — three columns, ascending, gold-dot on the mid one to signify pending work
export const JobsIcon: ComponentType<NavIconProps> = ({ size = 18, active = false, className }) => (
  <svg width={size} height={size} className={className} {...base(active)}>
    <rect x="4"  y="10" width="4" height="10" rx="1" />
    <rect x="10" y="6"  width="4" height="14" rx="1" />
    <rect x="16" y="12" width="4" height="8"  rx="1" />
    <circle cx="12" cy="10" r={active ? 1.8 : 1.2} fill={GOLD} stroke="none" />
  </svg>
);

// Reports — line chart rising, apex is a gold dot
export const ReportsIcon: ComponentType<NavIconProps> = ({ size = 18, active = false, className }) => (
  <svg width={size} height={size} className={className} {...base(active)}>
    <path d="M 4 20 L 4 4" />
    <path d="M 4 20 L 20 20" />
    <path d="M 6 16 L 10 12 L 13 15 L 18 7" />
    <circle cx="18" cy="7" r={active ? 2 : 1.4} fill={GOLD} stroke="none" />
  </svg>
);

// Settings — gear with a gold center gem (matches the mark itself)
export const SettingsIcon: ComponentType<NavIconProps> = ({ size = 18, active = false, className }) => (
  <svg width={size} height={size} className={className} {...base(active)}>
    <path d="M 12 3 L 13 5 L 15.5 4.5 L 16 7 L 18.5 7.5 L 18 10 L 20 12 L 18 14 L 18.5 16.5 L 16 17 L 15.5 19.5 L 13 19 L 12 21 L 11 19 L 8.5 19.5 L 8 17 L 5.5 16.5 L 6 14 L 4 12 L 6 10 L 5.5 7.5 L 8 7 L 8.5 4.5 L 11 5 Z" />
    <circle cx="12" cy="12" r={active ? 2 : 1.5} fill={GOLD} stroke="none" />
  </svg>
);

// Backup — floppy disk with a downward gold accent (data descending safely)
export const BackupIcon: ComponentType<NavIconProps> = ({ size = 18, active = false, className }) => (
  <svg width={size} height={size} className={className} {...base(active)}>
    <path d="M 5 4 L 5 20 L 19 20 L 19 8 L 15 4 Z" />
    <path d="M 8 4 L 8 9 L 15 9 L 15 4" />
    <rect x="8" y="13" width="8" height="6" rx="0.5" strokeWidth={1.2} />
    <path d="M 12 6 L 12 6" />
    <circle cx="13" cy="6.5" r={active ? 1.4 : 0.9} fill={GOLD} stroke="none" />
  </svg>
);

// Dev — wrench (developer-only; small icon, no gold accent needed)
export const DevIcon: ComponentType<NavIconProps> = ({ size = 18, active = false, className }) => (
  <svg width={size} height={size} className={className} {...base(active)}>
    <path d="M 15 4 A 5 5 0 0 0 9.5 10.5 L 4 16 L 4 20 L 8 20 L 13.5 14.5 A 5 5 0 0 0 20 9 L 17 12 L 14 9 L 17 6 Z" />
  </svg>
);
