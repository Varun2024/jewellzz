import { useEffect, useState } from 'react';
import {
  Receipt, ShoppingBag, Package, BookOpen, Users, Tag, Hammer,
  ChartLineUp, FloppyDisk, Wrench, Lightbulb, X, GearSix, Kanban, Recycle, Images,
} from '@phosphor-icons/react';
import { CH, invoke } from '@/lib/ipc';
import { fmtPaise } from '@/lib/format';
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
import { LogoMark, Wordmark } from '@/components/Logo';

const NAV = [
  { key: 'sale',     label: 'Sale',     shortcut: 'F2',  icon: Receipt },
  { key: 'purchase', label: 'Purchase', shortcut: 'F3',  icon: ShoppingBag },
  { key: 'stock',    label: 'Stock',    shortcut: 'F4',  icon: Package },
  { key: 'ledgers',  label: 'Ledgers',  shortcut: 'F5',  icon: BookOpen },
  { key: 'parties',  label: 'Parties',  shortcut: 'F6',  icon: Users },
  { key: 'items',    label: 'Items',    shortcut: 'F7',  icon: Tag },
  { key: 'catalog',  label: 'Catalog',  shortcut: '',    icon: Images },
  { key: 'karigar',  label: 'Karigar',  shortcut: 'F8',  icon: Hammer },
  { key: 'refining', label: 'Refining', shortcut: '',    icon: Recycle },
  { key: 'jobs',     label: 'Jobs',     shortcut: '',    icon: Kanban },
  { key: 'reports',  label: 'Reports',  shortcut: 'F12', icon: ChartLineUp },
  { key: 'settings', label: 'Settings', shortcut: '',    icon: GearSix },
  { key: 'backup',   label: 'Backup',   shortcut: 'F10', icon: FloppyDisk },
  { key: 'dev',      label: 'Dev',      shortcut: 'F11', icon: Wrench },
] as const;

type NavKey = (typeof NAV)[number]['key'];

interface CurrentUser { id: number; name: string; role: 'owner' | 'counter' }

export function Shell({ status, me, onLogout }: { status: string; me: CurrentUser; onLogout: () => void }) {
  const [active, setActive] = useState<NavKey>('sale');
  const [hintOpen, setHintOpen] = useState(() => localStorage.getItem('jewelzz.hint.dismissed') !== '1');
  const [rates, setRates] = useState<Record<string, number>>({});

  // Load rates once on mount; refresh when Settings screen is closed (naive: on interval).
  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const r = await invoke<MetalRate[]>(CH.ratesList);
        if (!alive) return;
        const m: Record<string, number> = {};
        for (const x of r) m[`${x.category}|${x.stamp}`] = x.ratePaisePerG;
        setRates(m);
      } catch { /* status bar can stay dashed */ }
    }
    load();
    const t = setInterval(load, 30_000);
    return () => { alive = false; clearInterval(t); };
  }, []);
  const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const time  = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  function dismissHint() {
    setHintOpen(false);
    try { localStorage.setItem('jewelzz.hint.dismissed', '1'); } catch { /* ignore */ }
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const m = NAV.find((n) => n.shortcut === e.key);
      if (m) { e.preventDefault(); setActive(m.key); }
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        (document.querySelector<HTMLInputElement>('input[placeholder^="search"]'))?.focus();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const activeItem = NAV.find((n) => n.key === active);

  return (
    <div className="flex h-full">
      {/* ─── sidebar ─────────────────────────────────────── */}
      <aside className="w-52 bg-[var(--paper-2)] border-r border-[var(--rule)] flex flex-col">
        <div className="px-5 py-4 border-b border-[var(--rule)] flex items-center gap-2">
          <LogoMark size={28} />
          <div>
            <Wordmark size={18} />
            <div className="text-[10px] text-[var(--ink-500)] mt-0.5 tracking-wider uppercase">Demo Jewellers</div>
          </div>
        </div>

        <nav className="flex-1 py-3">
          {NAV.map((n) => {
            const Icon = n.icon;
            const isActive = active === n.key;
            return (
              <button
                key={n.key}
                onClick={() => setActive(n.key)}
                className="nav-item"
                data-active={isActive}
              >
                <Icon size={16} weight={isActive ? 'fill' : 'regular'} />
                <span>{n.label}</span>
                {n.shortcut && <span className="kbd">{n.shortcut}</span>}
              </button>
            );
          })}
        </nav>

        <div className="px-5 py-3 border-t border-[var(--rule)]">
          <div className="text-[10px] tracking-widest uppercase text-[var(--ink-300)]">Est. 2026</div>
          <div className="text-[10px] mono text-[var(--ink-500)] mt-1">v0.0.1 · offline</div>
        </div>
      </aside>

      {/* ─── main pane ───────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-14 border-b border-[var(--rule)] bg-[var(--paper)] flex items-center px-6 justify-between gap-6">
          <div className="flex items-baseline gap-4">
            <span className="screen-title">{activeItem?.label}</span>
            <span className="text-[11px] mono text-[var(--ink-500)] tracking-wider">
              {today.toUpperCase()} · {time}
            </span>
          </div>

          <SearchBar
            onPick={(hit) => {
              if (hit.kind === 'item') setActive('items');
              if (hit.kind === 'party') setActive('parties');
            }}
          />
        </header>

        {/* First-launch hint bar */}
        {hintOpen && (
          <div className="flex items-center gap-3 px-6 py-2 border-b border-[var(--rule)]"
               style={{ background: 'linear-gradient(180deg, #FBF5E4 0%, var(--paper-2) 100%)' }}>
            <Lightbulb size={16} weight="fill" color="var(--gold-700)" />
            <div className="text-[12px] text-[var(--ink-700)] flex-1">
              <b className="text-[var(--ink-950)]">Quick keys:</b>{' '}
              <span className="mono text-[var(--ink-500)]">F2</span> new sale ·{' '}
              <span className="mono text-[var(--ink-500)]">F3</span> new purchase ·{' '}
              <span className="mono text-[var(--ink-500)]">F9</span> post &amp; print ·{' '}
              <span className="mono text-[var(--ink-500)]">/</span> search anywhere ·{' '}
              <span className="mono text-[var(--ink-500)]">F10</span> backup
            </div>
            <button onClick={dismissHint} className="btn-ghost" style={{ padding: 4, height: 24 }} aria-label="dismiss">
              <X size={12} />
            </button>
          </div>
        )}

        {/* Main content */}
        <main className="flex-1 overflow-auto px-6 py-6">
          <Screen area={active} />
        </main>

        {/* Bottom status bar — always-on shop telemetry */}
        <footer className="statusbar">
          <span><span className="dot dot-ok" /> IPC {status.startsWith('ok') ? 'ok' : status}</span>
          <span className="sep">·</span>
          <span>
            Au22k <span className="text-[var(--gold-700)]">
              {rates['gold|22k'] ? fmtPaise(rates['gold|22k']) + '/g' : '—'}
            </span>
          </span>
          <span className="sep">·</span>
          <span>
            Ag925 <span className="text-[var(--gold-700)]">
              {rates['silver|925'] ? fmtPaise(rates['silver|925']) + '/g' : '—'}
            </span>
          </span>
          <span className="ml-auto flex items-center gap-2">
            <span className="text-[var(--ink-500)]">
              <span className={me.role === 'owner' ? 'text-[var(--gold-700)]' : ''}>{me.name}</span>
              <span className="text-[var(--ink-300)]"> · {me.role}</span>
            </span>
            <button
              className="link"
              style={{ fontSize: 11 }}
              onClick={onLogout}
              title="sign out"
            >
              sign out
            </button>
          </span>
        </footer>
      </div>
    </div>
  );
}

function Screen({ area }: { area: NavKey }) {
  switch (area) {
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
