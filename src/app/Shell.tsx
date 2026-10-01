/* Shell — the app frame. Ported to v2 primitives.
 *
 * Layout: sidebar + main (header, optional first-launch hint, screen area,
 * status bar). Keyboard: shortcuts route to NAV keys; `/` focuses the Bell.
 * Rate ticker + idle-gem + Bell overlay all preserved.
 */

import { useEffect, useRef, useState } from 'react';
import {
  HomeIcon,
  SaleIcon, PurchaseIcon, StockIcon, LedgersIcon, PartiesIcon, ItemsIcon,
  CatalogIcon, KarigarIcon, RefiningIcon, JobsIcon, ReportsIcon,
  SettingsIcon, BackupIcon, DevIcon,
} from '@/components/icons/nav';
import { CH, invoke } from '@/lib/ipc';
import type { MetalRate } from '@shared/ipc';
import { PartiesScreen } from '@/features/parties/PartiesScreen';
import { ItemsScreen } from '@/features/items/ItemsScreen';
import { StockScreen } from '@/features/stock/StockScreen';
import { SaleScreen } from '@/features/sale/SaleScreen';
import { PurchaseScreen } from '@/features/purchase/PurchaseScreen';
import { LedgersScreen } from '@/features/ledgers/LedgersScreen';
import { KarigarScreen } from '@/features/karigar/KarigarScreen';
import { ReportsScreen } from '@/features/reports/ReportsScreen';
import { BackupScreen } from '@/features/backup/BackupScreen';
import { DevScreen } from '@/features/dev/DevScreen';
import { SearchBar } from '@/features/search/SearchBar';
import { SettingsScreen } from '@/features/settings/SettingsScreen';
import { JobsScreen } from '@/features/jobs/JobsScreen';
import { RefiningScreen } from '@/features/refining/RefiningScreen';
import { CatalogScreen } from '@/features/catalog/CatalogScreen';
import { HomeScreen } from '@/features/home/HomeScreen';
import { Bell } from '@/features/bell/Bell';
import { ShortcutSheet } from '@/features/shortcuts/ShortcutSheet';
import { LogoMark, Wordmark } from '@/components/Logo';
import { Nav, Kbd, Rupee } from '@/components/ui';

type NavEntry = {
  key: string;
  label: string;
  shortcut: string;
  icon: (typeof HomeIcon);
  ownerOnly?: boolean;
};

const NAV = [
  { key: 'home',     label: 'Today',    shortcut: '',    icon: HomeIcon, ownerOnly: true },
  { key: 'sale',     label: 'Sale',     shortcut: 'F2',  icon: SaleIcon },
  { key: 'purchase', label: 'Purchase', shortcut: 'F3',  icon: PurchaseIcon },
  { key: 'stock',    label: 'Stock',    shortcut: 'F4',  icon: StockIcon },
  { key: 'ledgers',  label: 'Ledgers',  shortcut: 'F5',  icon: LedgersIcon },
  { key: 'parties',  label: 'Parties',  shortcut: 'F6',  icon: PartiesIcon },
  { key: 'items',    label: 'Items',    shortcut: 'F7',  icon: ItemsIcon },
  { key: 'catalog',  label: 'Catalog',  shortcut: '',    icon: CatalogIcon },
  { key: 'karigar',  label: 'Karigar',  shortcut: 'F8',  icon: KarigarIcon },
  { key: 'refining', label: 'Refining', shortcut: '',    icon: RefiningIcon },
  { key: 'jobs',     label: 'Jobs',     shortcut: '',    icon: JobsIcon },
  { key: 'reports',  label: 'Reports',  shortcut: 'F12', icon: ReportsIcon },
  { key: 'settings', label: 'Settings', shortcut: '',    icon: SettingsIcon },
  { key: 'backup',   label: 'Backup',   shortcut: 'F10', icon: BackupIcon },
  { key: 'dev',      label: 'Dev',      shortcut: 'F11', icon: DevIcon },
] satisfies readonly NavEntry[];

type NavKey = (typeof NAV)[number]['key'];

interface CurrentUser { id: number; name: string; role: 'owner' | 'counter' }

export function Shell({
  status, me, onLogout, initialActive = 'sale',
}: {
  status: string;
  me: CurrentUser;
  onLogout: () => void;
  initialActive?: NavKey;
}) {
  const [active, setActive] = useState<NavKey>(initialActive);
  const visibleNav = NAV.filter((n) => !n.ownerOnly || me.role === 'owner');
  const [hintOpen, setHintOpen] = useState(() => localStorage.getItem('jewelzz.hint.dismissed') !== '1');
  const [rates, setRates] = useState<Record<string, number>>({});
  const prevRatesRef = useRef<Record<string, number>>({});
  const [rateDelta, setRateDelta] = useState<Record<string, 'up' | 'down'>>({});

  // Rate ticker — poll every 30s; flash the cell when a rate changes.
  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const r = await invoke<MetalRate[]>(CH.ratesList);
        if (!alive) return;
        const m: Record<string, number> = {};
        for (const x of r) m[`${x.category}|${x.stamp}`] = x.ratePaisePerG;
        const prev = prevRatesRef.current;
        if (Object.keys(prev).length > 0) {
          const delta: Record<string, 'up' | 'down'> = {};
          for (const k of Object.keys(m)) {
            if (prev[k] !== undefined && prev[k] !== m[k]) {
              delta[k] = m[k] > prev[k] ? 'up' : 'down';
            }
          }
          if (Object.keys(delta).length) {
            setRateDelta(delta);
            setTimeout(() => setRateDelta({}), 1000);
          }
        }
        prevRatesRef.current = m;
        setRates(m);
      } catch { /* status bar can stay dashed */ }
    }
    load();
    const t = setInterval(load, 30_000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  // Idle detection → gem pulse.
  const [idle, setIdle] = useState(false);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const reset = () => {
      setIdle(false);
      clearTimeout(t);
      t = setTimeout(() => setIdle(true), 60_000);
    };
    reset();
    const events = ['keydown', 'mousemove', 'mousedown', 'wheel', 'touchstart'] as const;
    events.forEach((ev) => window.addEventListener(ev, reset, { passive: true }));
    return () => {
      clearTimeout(t);
      events.forEach((ev) => window.removeEventListener(ev, reset));
    };
  }, []);

  // Live clock — ticks every 15s so the header stays present without burning
  // renders. 15s is enough to look alive; a per-second clock would be noise.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(t);
  }, []);
  const today = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const time  = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  function dismissHint() {
    setHintOpen(false);
    try { localStorage.setItem('jewelzz.hint.dismissed', '1'); } catch { /* ignore */ }
  }

  // Keyboard router — F2…F12 jump between screens; `/` focuses the search bar.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const m = NAV.find((n) => n.shortcut === e.key);
      if (m) { e.preventDefault(); setActive(m.key); }
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        document.querySelector<HTMLInputElement>('input[placeholder^="search"]')?.focus();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const activeItem = NAV.find((n) => n.key === active);

  return (
    <div className="ds-v2" style={{ display: 'flex', height: '100%', background: 'var(--bg)' }}>
      <Bell
        onJumpItems={() => setActive('items')}
        onJumpParties={() => setActive('parties')}
        onJumpTo={(a) => setActive(a as NavKey)}
      />
      <ShortcutSheet />

      {/* ---------- sidebar ---------- */}
      <aside style={{
        width: 220,
        background: 'var(--surface)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <div style={{
          padding: 'var(--s4)',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--s2)',
        }}>
          <LogoMark size={28} idle={idle} boot />
          <div style={{ minWidth: 0 }}>
            <Wordmark size={18} />
            <div style={{
              fontSize: 'var(--t-xs)',
              color: 'var(--text-mute)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginTop: 2,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>Demo Jewellers</div>
          </div>
        </div>

        <div style={{ flex: 1, overflow: 'auto' }}>
          <Nav>
            {visibleNav.map((n) => {
              const Icon = n.icon;
              const isActive = active === n.key;
              return (
                <Nav.Item
                  key={n.key}
                  active={isActive}
                  kbd={n.shortcut || undefined}
                  onClick={() => setActive(n.key)}
                  leading={<Icon size={16} active={isActive} />}
                >
                  {n.label}
                </Nav.Item>
              );
            })}
          </Nav>
        </div>

        <div style={{
          padding: 'var(--s3) var(--s4)',
          borderTop: '1px solid var(--border)',
          fontSize: 'var(--t-xs)',
          color: 'var(--text-faint)',
        }}>
          <div style={{ textTransform: 'uppercase', letterSpacing: '0.08em' }}>Est. 2026</div>
          <div style={{ fontFamily: 'var(--font-mono)', marginTop: 2 }}>v0.0.1 · offline</div>
        </div>
      </aside>

      {/* ---------- main pane ---------- */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Header */}
        <header style={{
          height: 48,
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 var(--container-pad)',
          gap: 'var(--s4)',
        }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--s3)', minWidth: 0 }}>
            <span style={{ fontSize: 'var(--t-lg)', fontWeight: 600 }}>
              {activeItem?.label}
            </span>
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--t-sm)',
              color: 'var(--text-mute)',
              letterSpacing: '0.04em',
            }}>
              {today.toUpperCase()} · {time}
            </span>
          </div>
          <div style={{ marginLeft: 'auto' }}>
            <SearchBar
              onPick={(hit) => {
                if (hit.kind === 'item')  setActive('items');
                if (hit.kind === 'party') setActive('parties');
              }}
            />
          </div>
        </header>

        {/* First-launch hint bar — low-key, gold-tinted stripe */}
        {hintOpen && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--s3)',
            padding: 'var(--s2) var(--container-pad)',
            borderBottom: '1px solid var(--border)',
            background: 'color-mix(in oklab, var(--gold-500) 8%, var(--surface))',
            fontSize: 'var(--t-sm)',
            color: 'var(--text-mute)',
          }}>
            <span style={{ color: 'var(--accent-press)', fontWeight: 500 }}>Quick keys</span>
            <HintKey keys={['Ctrl', 'Space']} label="ring the Bell" />
            <HintKey keys={['F2']} label="new sale" />
            <HintKey keys={['F9']} label="weigh &amp; print" />
            <HintKey keys={['/']} label="search" />
            <HintKey keys={['F10']} label="seal the day" />
            <HintKey keys={['?']} label="all shortcuts" />
            <button
              onClick={dismissHint}
              aria-label="dismiss"
              style={{
                marginLeft: 'auto',
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-mute)', fontSize: 16, lineHeight: 1,
                padding: 4,
              }}
            >×</button>
          </div>
        )}

        {/* Screen area — keyed wrapper triggers the screen-enter animation on every nav change */}
        <main style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
          <div key={active} className="ds-v2 screen-enter" style={{ height: '100%' }}>
            <Screen area={active} me={me} onOpenCounter={() => setActive('sale')} />
          </div>
        </main>

        {/* Status bar */}
        <footer style={{
          height: 28,
          borderTop: '1px solid var(--border)',
          background: 'var(--surface)',
          padding: '0 var(--container-pad)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--s3)',
          fontSize: 'var(--t-sm)',
          color: 'var(--text-mute)',
        }}>
          <StatusDot ok={status.startsWith('ok')} />
          <span>counter {status.startsWith('ok') ? 'open' : status}</span>
          <SepDot />
          <RateCell label="Au22k" value={rates['gold|22k']}   delta={rateDelta['gold|22k']} />
          <SepDot />
          <RateCell label="Ag925" value={rates['silver|925']} delta={rateDelta['silver|925']} />

          <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 'var(--s2)' }}>
            <span style={{ color: me.role === 'owner' ? 'var(--accent-press)' : 'var(--text-mute)', fontWeight: 500 }}>
              {me.name}
            </span>
            <span style={{ color: 'var(--text-faint)' }}>· {me.role}</span>
            <button
              onClick={onLogout}
              title="close the counter"
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--accent)', fontSize: 'var(--t-sm)', padding: 0,
              }}
            >
              close counter
            </button>
          </span>
        </footer>
      </div>
    </div>
  );
}

/* -------- status-bar bits -------- */

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      aria-hidden
      style={{
        width: 8, height: 8, borderRadius: '50%',
        background: ok ? 'var(--pos)' : 'var(--neg)',
        display: 'inline-block',
        boxShadow: ok ? '0 0 0 2px color-mix(in oklab, var(--pos) 20%, transparent)' : undefined,
      }}
    />
  );
}

function SepDot() {
  return <span style={{ color: 'var(--text-faint)' }}>·</span>;
}

function RateCell({ label, value, delta }: {
  label: string;
  value: number | undefined;
  delta: 'up' | 'down' | undefined;
}) {
  const arrow = delta === 'up' ? '▲' : delta === 'down' ? '▼' : '';
  const color =
    delta === 'up'   ? 'var(--pos)' :
    delta === 'down' ? 'var(--neg)' :
                       'var(--accent-press)';
  // The whole cell gets a brief gold-wash flash whenever a delta ticks in — a
  // quiet "something changed" signal in the periphery.
  return (
    <span
      key={value ?? 'empty'}
      className={delta ? 'rate-cell-flash' : undefined}
      style={{
        display: 'inline-flex',
        alignItems: 'baseline',
        gap: 4,
        padding: '0 4px',
        borderRadius: 3,
      }}
    >
      <span style={{ color: 'var(--text-mute)' }}>{label}</span>
      {value ? (
        <>
          {arrow && <span style={{ color, fontSize: 10 }}>{arrow}</span>}
          <span style={{
            color,
            fontFamily: 'var(--font-mono)',
            fontVariantNumeric: 'tabular-nums',
          }}>
            <Rupee paise={value} />
            <span style={{ color: 'var(--text-mute)', marginLeft: 1 }}>/g</span>
          </span>
        </>
      ) : <span style={{ color: 'var(--text-faint)' }}>—</span>}
    </span>
  );
}

function HintKey({ keys, label }: { keys: string[]; label: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      {keys.map((k, i) => (
        <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
          <Kbd>{k}</Kbd>
          {i < keys.length - 1 && <span style={{ color: 'var(--text-faint)' }}>+</span>}
        </span>
      ))}
      <span dangerouslySetInnerHTML={{ __html: label }} />
    </span>
  );
}

function Screen({ area, me, onOpenCounter }: {
  area: NavKey; me: CurrentUser; onOpenCounter: () => void;
}) {
  switch (area) {
    case 'home':     return <HomeScreen me={me} onOpenCounter={onOpenCounter} />;
    case 'sale':     return <SaleScreen />;
    case 'purchase': return <PurchaseScreen />;
    case 'stock':    return <StockScreen />;
    case 'ledgers':  return <LedgersScreen />;
    case 'parties':  return <PartiesScreen />;
    case 'items':    return <ItemsScreen />;
    case 'catalog':  return <CatalogScreen />;
    case 'karigar':  return <KarigarScreen />;
    case 'refining': return <RefiningScreen />;
    case 'jobs':     return <JobsScreen />;
    case 'reports':  return <ReportsScreen />;
    case 'settings': return <SettingsScreen />;
    case 'backup':   return <BackupScreen />;
    case 'dev':      return <DevScreen />;
    default:         return null;
  }
}
