import { useState } from 'react';
import { CH, invoke } from '@/lib/ipc';
import { useAsync } from '@/lib/useAsync';
import { fmtPaise, fmtGrams } from '@/lib/format';
import { ArrowRight, ArrowLeft } from '@phosphor-icons/react';
import { ErrorBanner, LoadingBlock, EmptyState } from '@/components/Status';
import type { Party } from '@shared/ipc';

type Tab = 'cash' | 'metal' | 'party';

export function LedgersScreen() {
  const [tab, setTab] = useState<Tab>('cash');
  return (
    <div className="space-y-5 max-w-6xl">
      <div className="tabs">
        {(['cash', 'metal', 'party'] as Tab[]).map((t) => (
          <button key={t} className="tab" data-active={tab === t} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>
      {tab === 'cash' && <CashLedger />}
      {tab === 'metal' && <MetalLedger />}
      {tab === 'party' && <PartyLedger />}
    </div>
  );
}

function CashLedger() {
  const r = useAsync<any[]>(() => invoke(CH.ledgerCash, {}));
  if (r.error) return <ErrorBanner message={r.error} onDismiss={() => r.reload()} />;
  if (r.loading) return <LoadingBlock label="loading cash ledger…" />;
  const rows = r.data ?? [];
  const closing = rows.length ? rows[rows.length - 1].balancePaise : 0;
  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <div className="text-xs text-muted">closing balance</div>
        <div className="mono">{fmtPaise(closing)}</div>
      </div>
      <table className="w-full text-xs">
        <thead className="text-muted border-b border-border">
          <tr>
            <th className="text-left py-1">When</th><th className="text-left">Ref</th><th className="text-left">Note</th>
            <th className="text-right">Debit</th><th className="text-right">Credit</th><th className="text-right">Balance</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-border/50">
              <td className="py-1 mono">{new Date(r.ts * 1000).toLocaleString('en-IN')}</td>
              <td className="mono text-muted">{r.refType} #{r.refId ?? ''}</td>
              <td>{r.note}</td>
              <td className="text-right mono">{r.debitPaise ? fmtPaise(r.debitPaise) : ''}</td>
              <td className="text-right mono">{r.creditPaise ? fmtPaise(r.creditPaise) : ''}</td>
              <td className="text-right mono">{fmtPaise(r.balancePaise)}</td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={6}><EmptyState>no cash movements</EmptyState></td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function MetalLedger() {
  const buckets = useAsync<any[]>(() => invoke(CH.metalBuckets));
  const [bucket, setBucket] = useState<{ category: string; stamp: string } | null>(null);
  const rows = useAsync<any[]>(
    () => bucket ? invoke(CH.ledgerMetal, { category: bucket.category, stamp: bucket.stamp }) : Promise.resolve([]),
    [bucket?.category, bucket?.stamp],
  );

  return (
    <div className="grid grid-cols-[240px_1fr] gap-4">
      <div>
        <div className="text-xs text-muted mb-1">buckets</div>
        {buckets.error && <ErrorBanner message={buckets.error} onDismiss={() => buckets.reload()} />}
        {buckets.loading ? <LoadingBlock label="loading…" /> : (
          <ul className="text-xs">
            {(buckets.data ?? []).map((b, i) => (
              <li key={i}>
                <button
                  onClick={() => setBucket({ category: b.category, stamp: b.stamp })}
                  className={`w-full text-left px-2 py-1.5 hover:bg-[var(--bg-hover)] rounded ${bucket?.category === b.category && bucket?.stamp === b.stamp ? 'bg-[var(--bg-hover)]' : ''}`}
                >
                  <div className="flex justify-between">
                    <span>{b.category}{b.stamp ? ` · ${b.stamp}` : ''}</span>
                    <span className="mono">{fmtGrams(b.balanceMg)}</span>
                  </div>
                </button>
              </li>
            ))}
            {(buckets.data?.length ?? 0) === 0 && <li className="text-muted">no metal movements</li>}
          </ul>
        )}
      </div>
      <div>
        {!bucket && <div className="text-muted text-sm">select a bucket</div>}
        {bucket && rows.error && <ErrorBanner message={rows.error} onDismiss={() => rows.reload()} />}
        {bucket && rows.loading && <LoadingBlock label="loading rows…" />}
        {bucket && !rows.loading && !rows.error && (
          <table className="w-full text-xs">
            <thead className="text-muted border-b border-border">
              <tr>
                <th className="text-left py-1">When</th><th className="text-left">Ref</th><th className="text-left">Note</th>
                <th className="text-right">Debit (in)</th><th className="text-right">Credit (out)</th><th className="text-right">Balance</th>
              </tr>
            </thead>
            <tbody>
              {(rows.data ?? []).map((r) => (
                <tr key={r.id} className="border-b border-border/50">
                  <td className="py-1 mono">{new Date(r.ts * 1000).toLocaleString('en-IN')}</td>
                  <td className="mono text-muted">{r.refType} #{r.refId ?? ''}</td>
                  <td>{r.note}</td>
                  <td className="text-right mono">{r.debitMg ? fmtGrams(r.debitMg) : ''}</td>
                  <td className="text-right mono">{r.creditMg ? fmtGrams(r.creditMg) : ''}</td>
                  <td className="text-right mono">{fmtGrams(r.balanceMg)}</td>
                </tr>
              ))}
              {(rows.data?.length ?? 0) === 0 && <tr><td colSpan={6}><EmptyState>no rows</EmptyState></td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function PartyLedger() {
  const parties = useAsync<Party[]>(() => invoke(CH.partiesList));
  const [partyId, setPartyId] = useState<number | null>(null);
  const rows = useAsync<any[]>(
    () => partyId ? invoke(CH.ledgerParty, { partyId }) : Promise.resolve([]),
    [partyId],
  );

  const cashRows = (rows.data ?? []).filter((r) => r.kind === 'cash');
  const cashClose = cashRows.length ? cashRows[cashRows.length - 1].balance : 0;
  const metalRows = (rows.data ?? []).filter((r) => r.kind === 'metal');

  return (
    <div className="space-y-3">
      {parties.error && <ErrorBanner message={parties.error} onDismiss={() => parties.reload()} />}
      <select
        className="input" value={partyId ?? ''}
        onChange={(e) => setPartyId(Number(e.target.value) || null)}
        disabled={parties.loading}
      >
        <option value="">{parties.loading ? 'loading parties…' : '— pick party —'}</option>
        {(parties.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.name} ({p.role})</option>)}
      </select>
      {partyId && rows.error && <ErrorBanner message={rows.error} onDismiss={() => rows.reload()} />}
      {partyId && rows.loading && <LoadingBlock label="loading ledger…" />}
      {partyId && !rows.loading && !rows.error && (
        <>
          <OwesIndicator paise={cashClose} />

          <table className="w-full text-xs">
            <thead className="text-muted border-b border-border">
              <tr>
                <th className="text-left py-1">When</th><th className="text-left">Kind</th>
                <th className="text-left">Ref</th><th className="text-left">Note</th>
                <th className="text-right">Debit</th><th className="text-right">Credit</th><th className="text-right">Balance</th>
              </tr>
            </thead>
            <tbody>
              {(rows.data ?? []).map((r) => (
                <tr key={r.id} className="border-b border-border/50">
                  <td className="py-1 mono">{new Date(r.ts * 1000).toLocaleString('en-IN')}</td>
                  <td>{r.kind}{r.kind === 'metal' && r.category ? ` · ${r.category}${r.stamp ? '/' + r.stamp : ''}` : ''}</td>
                  <td className="mono text-muted">{r.refType} #{r.refId ?? ''}</td>
                  <td>{r.note}</td>
                  <td className="text-right mono">{r.debit ? (r.kind === 'cash' ? fmtPaise(r.debit) : fmtGrams(r.debit)) : ''}</td>
                  <td className="text-right mono">{r.credit ? (r.kind === 'cash' ? fmtPaise(r.credit) : fmtGrams(r.credit)) : ''}</td>
                  <td className="text-right mono">{r.kind === 'cash' ? fmtPaise(r.balance) : fmtGrams(r.balance)}</td>
                </tr>
              ))}
              {(rows.data?.length ?? 0) === 0 && <tr><td colSpan={7}><EmptyState>no movements</EmptyState></td></tr>}
            </tbody>
          </table>
          {metalRows.length > 0 && <div className="text-xs text-muted">metal columns tracked per (category, stamp) bucket; positive = party owes, negative = shop owes.</div>}
        </>
      )}
    </div>
  );
}

function OwesIndicator({ paise }: { paise: number }) {
  if (paise === 0) {
    return (
      <div className="card flex items-center gap-3" style={{ borderColor: 'var(--rule)' }}>
        <div className="text-xs mono uppercase tracking-widest text-[var(--ink-500)]">All settled</div>
        <div className="text-lg mono">{fmtPaise(0)}</div>
      </div>
    );
  }
  const partyOwes = paise > 0;
  return (
    <div
      className="card flex items-center gap-4"
      style={{
        borderColor: partyOwes ? 'var(--rose-500)' : 'var(--moss-600)',
        background: partyOwes ? 'rgba(160, 44, 44, 0.06)' : 'rgba(74, 107, 58, 0.06)',
      }}
    >
      {partyOwes
        ? <ArrowRight size={22} weight="bold" color="var(--rose-500)" />
        : <ArrowLeft size={22} weight="bold" color="var(--moss-600)" />}
      <div className="flex-1">
        <div className="text-[10px] mono uppercase tracking-widest" style={{ color: partyOwes ? 'var(--rose-500)' : 'var(--moss-600)' }}>
          {partyOwes ? 'party owes shop' : 'shop owes party'}
        </div>
        <div className="mono" style={{ fontSize: 22, letterSpacing: '-0.01em', color: partyOwes ? 'var(--rose-700)' : 'var(--moss-600)', fontWeight: 500 }}>
          {fmtPaise(Math.abs(paise))}
        </div>
      </div>
    </div>
  );
}
