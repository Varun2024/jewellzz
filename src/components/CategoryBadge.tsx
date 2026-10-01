/* Small chip that shows an item's metal/stone category + optional stamp.
 * Uses v2 tokens via inline styles — no class dependencies.
 */

import { Circle, Diamond, Sparkle } from '@phosphor-icons/react';

type Cat = 'gold' | 'silver' | 'stone' | 'artificial';

const CFG: Record<Cat, { label: string; icon: typeof Circle; fill: string; bg: string; border: string }> = {
  gold: {
    label: 'gold',
    icon: Circle,
    fill: 'var(--accent-press, #8A6420)',
    bg: 'color-mix(in oklab, var(--accent, #B8892E) 12%, transparent)',
    border: 'color-mix(in oklab, var(--accent, #B8892E) 35%, transparent)',
  },
  silver: {
    label: 'silver',
    icon: Circle,
    fill: '#4A5865',
    bg: 'rgba(74, 88, 101, 0.10)',
    border: 'rgba(74, 88, 101, 0.30)',
  },
  stone: {
    label: 'stone',
    icon: Diamond,
    fill: '#3A6373',
    bg: 'rgba(58, 99, 115, 0.10)',
    border: 'rgba(58, 99, 115, 0.30)',
  },
  artificial: {
    label: 'artificial',
    icon: Sparkle,
    fill: 'var(--text-mute, #7A6E64)',
    bg: 'color-mix(in oklab, currentColor 10%, transparent)',
    border: 'color-mix(in oklab, currentColor 25%, transparent)',
  },
};

export function CategoryBadge({
  category,
  stamp,
  size = 'sm',
}: {
  category: Cat;
  stamp?: string | null;
  size?: 'sm' | 'md';
}) {
  const cfg = CFG[category];
  const Icon = cfg.icon;
  const isMd = size === 'md';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        color: cfg.fill,
        padding: isMd ? '2px 8px' : '1px 6px',
        fontSize: isMd ? 11 : 10,
        fontWeight: 500,
        letterSpacing: '0.03em',
        lineHeight: 1.3,
        whiteSpace: 'nowrap',
        borderRadius: 3,
      }}
    >
      <Icon size={isMd ? 10 : 8} weight="fill" />
      <span style={{ textTransform: 'lowercase' }}>{cfg.label}</span>
      {stamp && (
        <span
          style={{
            fontFamily: 'var(--font-mono, ui-monospace, monospace)',
            fontSize: isMd ? 10 : 9,
            opacity: 0.75,
            marginLeft: 2,
          }}
        >
          {stamp}
        </span>
      )}
    </span>
  );
}
