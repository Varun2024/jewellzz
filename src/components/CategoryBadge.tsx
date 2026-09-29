import { Circle, Diamond, Sparkle } from '@phosphor-icons/react';

type Cat = 'gold' | 'silver' | 'stone' | 'artificial';

const CFG: Record<Cat, { label: string; icon: any; fill: string; bg: string; border: string }> = {
  gold: {
    label: 'gold',
    icon: Circle,
    fill: '#8E6A20',
    bg: 'rgba(184, 137, 46, 0.12)',
    border: 'rgba(184, 137, 46, 0.35)',
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
    fill: '#7A6E64',
    bg: 'rgba(122, 110, 100, 0.10)',
    border: 'rgba(122, 110, 100, 0.30)',
  },
};

export function CategoryBadge({ category, stamp, size = 'sm' }: { category: Cat; stamp?: string | null; size?: 'sm' | 'md' }) {
  const cfg = CFG[category];
  const Icon = cfg.icon;
  const isMd = size === 'md';
  return (
    <span
      className="inline-flex items-center gap-1 rounded"
      style={{
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        color: cfg.fill,
        padding: isMd ? '2px 8px' : '1px 6px',
        fontSize: isMd ? 11 : 10,
        fontWeight: 500,
        letterSpacing: '0.03em',
        lineHeight: 1.3,
        whiteSpace: 'nowrap',
      }}
    >
      <Icon size={isMd ? 10 : 8} weight="fill" />
      <span style={{ textTransform: 'lowercase' }}>{cfg.label}</span>
      {stamp && (
        <span
          className="mono"
          style={{ fontSize: isMd ? 10 : 9, opacity: 0.75, marginLeft: 2 }}
        >
          {stamp}
        </span>
      )}
    </span>
  );
}
