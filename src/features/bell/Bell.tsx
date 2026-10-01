/* The Bell — Ctrl+Space (or Cmd+Space) summons a floating glance panel.
 * Ported to v2 primitives.
 */

import { useEffect, useRef, useState } from 'react';
import { CH, invoke } from '@/lib/ipc';
import type { MetalRate, SearchHit } from '@shared/ipc';
import { Kbd, Rupee, Num } from '@/components/ui';
import {
  SaleIcon, PurchaseIcon, LedgersIcon, ReportsIcon, KarigarIcon, BackupIcon,
} from '@/components/icons/nav';

export type BellArea = 'sale' | 'purchase' | 'ledgers' | 'reports' | 'karigar' | 'backup';

export function Bell({
  onJumpItems,
  onJumpParties,
  onJumpTo,
}: {
  onJumpItems: () => void;
  onJumpParties: () => void;
  onJumpTo?: (area: BellArea) => void;
}) {
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isMac = navigator.platform.toUpperCase().includes('MAC');
      const primary = isMac ? e.metaKey : e.ctrlKey;
      if (primary && (e.code === 'Space' || e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === 'Escape' && open) {
        e.preventDefault();
        setOpen(false);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 30);
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="ds-v2"
      onClick={() => setOpen(false)}
      style={{
        position: 'fixed', inset: 0,
        background: 'var(--scrim)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: '10vh', zIndex: 200,
        animation: 'ds-screen-enter 180ms var(--ease-out, cubic-bezier(0.20, 0, 0, 1))',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 580, maxWidth: '92%',
          background: 'var(--surface)',
          border: '1px solid var(--border-strong)',
          borderRadius: 'var(--radius-2)',
          overflow: 'hidden',
        }}
      >
        <BellSearch inputRef={inputRef} onPick={(hit) => {
          setOpen(false);
          if (hit.kind === 'item') onJumpItems();
          if (hit.kind === 'party') onJumpParties();
        }} onJumpTo={(a) => { setOpen(false); onJumpTo?.(a); }} />
        <BellGlance />
        <div style={{
          padding: '8px 14px',
          borderTop: '1px solid var(--border)',
          fontSize: 'var(--t-xs)',
          color: 'var(--text-mute)',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          display: 'flex', gap: 12, justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Kbd>Esc</Kbd> to close
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Kbd>Ctrl</Kbd> <Kbd>Space</Kbd> the Bell
          </span>
        </div>
      </div>
    </div>
  );
}

const JUMP_ACTIONS: Array<{ area: BellArea; label: string; kbd: string; icon: typeof SaleIcon }> = [
  { area: 'sale',     label: 'New sale',        kbd: 'F2',  icon: SaleIcon },
  { area: 'purchase', label: 'New purchase',    kbd: 'F3',  icon: PurchaseIcon },
  { area: 'ledgers',  label: 'Open ledgers',    kbd: 'F5',  icon: LedgersIcon },
  { area: 'karigar',  label: 'Workshop',        kbd: 'F8',  icon: KarigarIcon },
  { area: 'reports',  label: 'GST reports',     kbd: 'F12', icon: ReportsIcon },
  { area: 'backup',   label: 'Seal the day',    kbd: 'F10', icon: BackupIcon },
];

function BellSearch({
  inputRef,
  onPick,
  onJumpTo,
}: {
  inputRef: React.RefObject<HTMLInputElement>;
  onPick: (hit: SearchHit) => void;
  onJumpTo: (a: BellArea) => void;
}) {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);

  useEffect(() => {
    if (!q.trim()) { setHits([]); return; }
    const t = setTimeout(async () => {
      try {
        const r = await invoke<SearchHit[]>(CH.search, { q, scope: 'all', limit: 8 });
        setHits(r);
      } catch { setHits([]); }
    }, 100);
    return () => clearTimeout(t);
  }, [q]);

  const empty = !q.trim();

  return (
    <div style={{ padding: 'var(--s3)', borderBottom: '1px solid var(--border)' }}>
      <input
        ref={inputRef}
        className="input"
        placeholder="search item or customer, Enter to jump"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && hits[0]) { e.preventDefault(); onPick(hits[0]); }
        }}
        style={{ width: '100%', height: 40, fontSize: 15 }}
      />

      {/* when the search is empty, the Bell doubles as a jump-to command panel */}
      {empty && (
        <div style={{
          marginTop: 'var(--s2)',
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 'var(--s2)',
        }}>
          {JUMP_ACTIONS.map((a) => {
            const Icon = a.icon;
            return (
              <button
                key={a.area}
                onClick={() => onJumpTo(a.area)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 'var(--s2)',
                  padding: '8px 10px',
                  background: 'var(--surface-hi)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-1)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  color: 'var(--text)',
                  transition: 'border-color var(--motion-quick) var(--ease-out)',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
              >
                <Icon size={16} active />
                <span style={{ fontSize: 'var(--t-sm)', flex: 1 }}>{a.label}</span>
                <Kbd>{a.kbd}</Kbd>
              </button>
            );
          })}
        </div>
      )}

      {hits.length > 0 && (
        <div style={{
          marginTop: 'var(--s2)',
          borderTop: '1px dashed var(--border)',
          paddingTop: 'var(--s2)',
        }}>
          {hits.map((h) => (
            <button
              key={`${h.kind}-${h.id}`}
              onClick={() => onPick(h)}
              style={{
                display: 'flex', width: '100%', justifyContent: 'space-between',
                padding: '6px 6px',
                background: 'transparent', border: 0, cursor: 'pointer',
                textAlign: 'left', color: 'var(--text)',
                borderRadius: 3,
              }}
            >
              <span>{h.name}</span>
              <span style={{
                fontFamily: 'var(--font-mono)',
                color: 'var(--text-mute)',
                fontSize: 'var(--t-sm)',
              }}>
                {h.kind === 'item'
                  ? `${h.sku} · ${h.category}${h.stamp ? ' · ' + h.stamp : ''}`
                  : `${h.role}${h.phone ? ' · ' + h.phone : ''}`}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function BellGlance() {
  const [rates, setRates] = useState<MetalRate[]>([]);
  const [openApprovals, setOpenApprovals] = useState(0);
  const [activeOrders, setActiveOrders] = useState(0);
  const [karigarsWithMetal, setKarigarsWithMetal] = useState(0);
  const [todayCount, setTodayCount] = useState(0);
  const [todayTotal, setTodayTotal] = useState(0);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const now = new Date();
        const start = Math.floor(new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 1000);
        const end = Math.floor(now.getTime() / 1000);
        const [r, ap, ord, karBal, sales] = await Promise.all([
          invoke<MetalRate[]>(CH.ratesList),
          invoke<any[]>(CH.approvalsList, { status: 'open' }),
          invoke<any[]>(CH.ordersList, {}),
          invoke<Array<{ metalBalanceMg: number }>>(CH.karigarBalances),
          invoke<Array<{ totalPaise: number }>>(CH.salesList, { fromTs: start, toTs: end }),
        ]);
        if (!alive) return;
        setRates(r);
        setOpenApprovals(ap.length);
        setActiveOrders(ord.filter((o) => o.status === 'open' || o.status === 'in_progress' || o.status === 'ready').length);
        setKarigarsWithMetal(karBal.filter((k) => k.metalBalanceMg > 0).length);
        setTodayCount(sales.length);
        setTodayTotal(sales.reduce((s, r) => s + r.totalPaise, 0));
      } catch { /* silent */ }
    }
    load();
    return () => { alive = false; };
  }, []);

  const au22k = rates.find((r) => r.category === 'gold'   && r.stamp === '22k');
  const ag925 = rates.find((r) => r.category === 'silver' && r.stamp === '925');

  return (
    <div style={{ padding: 'var(--s3)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--s3)' }}>
      <GlanceCard title="rates">
        <GlanceRow label="Au 22k" value={au22k ? <><Rupee paise={au22k.ratePaisePerG} />/g</> : '—'} />
        <GlanceRow label="Ag 925" value={ag925 ? <><Rupee paise={ag925.ratePaisePerG} />/g</> : '—'} />
      </GlanceCard>

      <GlanceCard title="today">
        <GlanceRow label="Bills" value={<Num value={todayCount} />} />
        <GlanceRow label="Counter" value={<Rupee paise={todayTotal} />} />
      </GlanceCard>

      <div style={{ gridColumn: '1 / -1' }}>
        <GlanceCard title="waiting">
          {(openApprovals + activeOrders + karigarsWithMetal) === 0
            ? <div style={{ fontSize: 'var(--t-sm)', color: 'var(--text-mute)' }}>the ledger is clear.</div>
            : (
              <div style={{ display: 'flex', gap: 'var(--s5)', flexWrap: 'wrap' }}>
                {openApprovals > 0        && <WaitingItem count={openApprovals}        label={openApprovals === 1        ? 'approval'            : 'approvals'} />}
                {activeOrders > 0         && <WaitingItem count={activeOrders}         label={activeOrders === 1         ? 'order in progress'   : 'orders in progress'} />}
                {karigarsWithMetal > 0    && <WaitingItem count={karigarsWithMetal}    label={karigarsWithMetal === 1    ? 'karigar holds metal' : 'karigars hold metal'} />}
              </div>
            )}
        </GlanceCard>
      </div>
    </div>
  );
}

function GlanceCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{
        fontSize: 'var(--t-xs)', color: 'var(--text-mute)',
        textTransform: 'uppercase', letterSpacing: '0.08em',
        marginBottom: 4,
      }}>{title}</div>
      <div style={{
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-1)',
        padding: '8px 10px',
        background: 'var(--surface-hi)',
      }}>
        {children}
      </div>
    </div>
  );
}

function GlanceRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <span style={{ fontSize: 'var(--t-sm)', color: 'var(--text-mute)' }}>{label}</span>
      <span style={{ fontSize: 'var(--t-md)' }}>{value}</span>
    </div>
  );
}

function WaitingItem({ count, label }: { count: number; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
      <span style={{ fontSize: 18, color: 'var(--accent-press)', fontFamily: 'var(--font-mono)' }}>{count}</span>
      <span style={{ fontSize: 'var(--t-sm)', color: 'var(--text-mute)' }}>{label}</span>
    </div>
  );
}
