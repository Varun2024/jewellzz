import { useState } from 'react';
import { ArrowLeft, ArrowRight } from '@phosphor-icons/react';
import { CH, invoke } from '@/lib/ipc';
import { useAsync } from '@/lib/useAsync';
import { fmtPaise, fmtGrams } from '@/lib/format';
import { ErrorBanner, LoadingBlock, EmptyState } from '@/components/Status';
import type { Karigar } from '@shared/ipc';

export function LedgerTab() {
  const karigars = useAsync<Karigar[]>(() => invoke(CH.karigarsList));
  const [karigarId, setKarigarId] = useState<number | null>(null);
  const rows = useAsync<any[]>(
    () => karigarId ? invoke(CH.karigarLedger, { karigarId }) : Promise.resolve([]),
    [karigarId],
  );

  const cashRows = (rows.data ?? []).filter((r) => r.kind === 'cash');
  const cashClose = cashRows.length ? cashRows[cashRows.length - 1].balance : 0;
  const metalRows = (rows.data ?? []).filter((r) => r.kind === 'metal');

  return (
    <div className="space-y-3">
      {karigars.error && <ErrorBanner message={karigars.error} onDismiss={() => karigars.reload()} />}
      <select className="input" value={karigarId ?? ''} onChange={(e) => setKarigarId(Number(e.target.value) || null)} disabled={karigars.loading}>
        <option value="">{karigars.loading ? 'loading…' : '— pick karigar —'}</option>
        {(karigars.data ?? []).map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
      </select>

      {karigarId && rows.error && <ErrorBanner message={rows.error} onDismiss={() => rows.reload()} />}
      {karigarId && rows.loading && <LoadingBlock label="loading ledger…" />}
      {karigarId && !rows.loading && !rows.error && (
        <>
          <KarigarOwesIndicator paise={cashClose} />

          <table className="w-full text-xs">
            <thead className="text-muted border-b border-border">
              <tr>
                <th className="text-left py-1">When</th>
                <th className="text-left">Kind</th>
                <th className="text-left">Ref</th>
                <th className="text-left">Note</th>
                <th className="text-right">Debit</th>
                <th className="text-right">Credit</th>
                <th className="text-right">Balance</th>
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
          {metalRows.length > 0 && <p className="text-xs text-muted">metal balances tracked per (category, stamp) bucket; positive = karigar owes shop, zero = settled.</p>}
        </>
      )}
    </div>
  );
}

function KarigarOwesIndicator({ paise }: { paise: number }) {
  // For karigar: cash convention is credit = shop owes labour.
  // So negative balance = shop owes karigar, positive = karigar owes shop (rare, from over-payment).
  if (paise === 0) {
    return (
      <div className="card flex items-center gap-3">
        <div className="text-xs mono uppercase tracking-widest text-[var(--ink-500)]">All settled</div>
        <div className="text-lg mono">{fmtPaise(0)}</div>
      </div>
    );
  }
  const shopOwes = paise < 0;
  return (
    <div
      className="card flex items-center gap-4"
      style={{
        borderColor: shopOwes ? 'var(--amber-500)' : 'var(--rose-500)',
        background: shopOwes ? 'rgba(192, 130, 30, 0.06)' : 'rgba(160, 44, 44, 0.06)',
      }}
    >
      {shopOwes
        ? <ArrowRight size={22} weight="bold" color="var(--amber-500)" />
        : <ArrowLeft size={22} weight="bold" color="var(--rose-500)" />}
      <div className="flex-1">
        <div className="text-[10px] mono uppercase tracking-widest" style={{ color: shopOwes ? 'var(--amber-500)' : 'var(--rose-500)' }}>
          {shopOwes ? 'shop owes karigar labour' : 'karigar owes shop'}
        </div>
        <div className="mono" style={{ fontSize: 22, letterSpacing: '-0.01em', color: shopOwes ? 'var(--amber-500)' : 'var(--rose-700)', fontWeight: 500 }}>
          {fmtPaise(Math.abs(paise))}
        </div>
      </div>
    </div>
  );
}
