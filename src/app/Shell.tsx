import { useEffect, useState } from 'react';
import {
  Receipt, ShoppingBag, Package, BookOpen, Users, Tag, Hammer,
  ChartLineUp, FloppyDisk, Wrench, Lightbulb, X,
} from '@phosphor-icons/react';
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
import { LogoMark, Wordmark } from '@/components/Logo';

const NAV = [
  { key: 'sale',     label: 'Sale',     shortcut: 'F2',  icon: Receipt },
  { key: 'purchase', label: 'Purchase', shortcut: 'F3',  icon: ShoppingBag },
  { key: 'stock',    label: 'Stock',    shortcut: 'F4',  icon: Package },
  { key: 'ledgers',  label: 'Ledgers',  shortcut: 'F5',  icon: BookOpen },
  { key: 'parties',  label: 'Parties',  shortcut: 'F6',  icon: Users },
  { key: 'items',    label: 'Items',    shortcut: 'F7',  icon: Tag },
  { key: 'karigar',  label: 'Karigar',  shortcut: 'F8',  icon: Hammer },
  { key: 'reports',  label: 'Reports',  shortcut: 'F12', icon: ChartLineUp },
  { key: 'backup',   label: 'Backup',   shortcut: 'F10', icon: FloppyDisk },
  { key: 'dev',      label: 'Dev',      shortcut: 'F11', icon: Wrench },
] as const;

type NavKey = (typeof NAV)[number]['key'];

export function Shell({ status }: { status: string }) {
  const [active, setActive] = useState<NavKey>('sale');
  const [hintOpen, setHintOpen] = useState(() => localStorage.getItem('jewelzz.hint.dismissed') !== '1');
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
                <span className="kbd">{n.shortcut}</span>
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
          <span>Backup 0h ago</span>
          <span className="sep">·</span>
          <span>Au22k <span className="text-[var(--gold-700)]">—</span></span>
          <span className="sep">·</span>
          <span>Ag925 <span className="text-[var(--gold-700)]">—</span></span>
          <span className="ml-auto text-[var(--ink-300)]">press / to search · F2–F12 to navigate</span>
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
    case 'karigar':  return <KarigarScreen />;
    case 'reports':  return <ReportsScreen />;
    case 'backup':   return <BackupScreen />;
    case 'dev':      return <DevScreen />;
    default:         return null;
  }
}
