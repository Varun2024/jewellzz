/* Karigar ledger — ported to v2 primitives. */

import { useState } from 'react';
import { CH, invoke } from '@/lib/ipc';
import { useAsync } from '@/lib/useAsync';
import type { Karigar } from '@shared/ipc';
import {
  Sheet, Rupee, Weight, Pill, Progress, Empty,
} from '@/components/ui';
import { BalancedMark } from '@/components/illustrations';

export function LedgerTab() {
  const karigars = useAsync<Karigar[]>(() => invoke(CH.karigarsList));
  const [karigarId, setKarigarId] = useState<number | null>(null);
  const rows = useAsync<any[]>(
    () => karigarId ? invoke(CH.karigarLedger, { karigarId }) : Promise.resolve([]),
    [karigarId],
  );

  const cashRows = (rows.data ?? []).filter((r) => r.kind === 'cash');
  const cashClose = cashRows.length ? cashRows[cashRows.length - 1].balance : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s3)' }}>
      {karigars.error && <InlineAlert message={karigars.error} onDismiss={() => karigars.reload()} />}
      <div className="field" style={{ maxWidth: 360 }}>
        <label className="field__label">Karigar</label>
        <select
          className="input"
          value={karigarId ?? ''}
          onChange={(e) => setKarigarId(Number(e.target.value) || null)}
          disabled={karigars.loading}
        >
          <option value="">{karigars.loading ? 'loading…' : '— pick karigar —'}</option>
          {(karigars.data ?? []).map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
        </select>
      </div>

      {karigarId && rows.error   && <InlineAlert message={rows.error} onDismiss={() => rows.reload()} />}
      {karigarId && rows.loading && <Progress />}
      {karigarId && !rows.loading && !rows.error && (
        <>
          <KarigarOwesCard paise={cashClose} />
          <Sheet title="Movements" flush>
            {(rows.data?.length ?? 0) === 0 ? (
              <Empty mark="ledger" title="No movements yet" />
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: 150 }}>When</th>
                    <th style={{ width: 90 }}>Kind</th>
                    <th style={{ width: 150 }}>Ref</th>
                    <th>Note</th>
                    <th className="num" style={{ width: 120 }}>Debit</th>
                    <th className="num" style={{ width: 120 }}>Credit</th>
                    <th className="num" style={{ width: 140 }}>Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {(rows.data ?? []).map((r) => (
                    <tr key={r.id}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-sm)', color: 'var(--text-mute)' }}>
                        {new Date(r.ts * 1000).toLocaleString('en-IN')}
                      </td>
                      <td style={{ fontSize: 'var(--t-sm)' }}>
                        {r.kind}
                        {r.kind === 'metal' && r.category ? ` · ${r.category}${r.stamp ? '/' + r.stamp : ''}` : ''}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-sm)', color: 'var(--text-mute)' }}>
                        {r.refType} #{r.refId ?? ''}
                      </td>
                      <td>{r.note}</td>
                      <td className="num">
                        {r.debit ? (r.kind === 'cash' ? <Rupee paise={r.debit} /> : <Weight mg={r.debit} />) : ''}
                      </td>
                      <td className="num">
                        {r.credit ? (r.kind === 'cash' ? <Rupee paise={r.credit} /> : <Weight mg={r.credit} />) : ''}
                      </td>
                      <td className="num">
                        {r.kind === 'cash' ? <Rupee paise={r.balance} /> : <Weight mg={r.balance} />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Sheet>
          <div style={{ fontSize: 'var(--t-xs)', color: 'var(--text-faint)' }}>
            Metal balances tracked per (category, stamp) bucket; positive = karigar owes shop, zero = settled.
          </div>
        </>
      )}
    </div>
  );
}

/* Cash convention: credit = shop owes labour. So negative = shop owes karigar. */
function KarigarOwesCard({ paise }: { paise: number }) {
  if (paise === 0) {
    return (
      <Sheet>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s4)' }}>
          <BalancedMark size={56} />
          <div>
            <Pill>settled</Pill>
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--t-lg)',
              color: 'var(--text-mute)',
              marginTop: 4,
            }}>
              <Rupee paise={0} />
            </div>
          </div>
        </div>
      </Sheet>
    );
  }
  const shopOwes = paise < 0;
  return (
    <Sheet>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s4)' }}>
        <Pill tone={shopOwes ? 'accent' : 'neg'}>
          {shopOwes ? 'shop owes karigar labour' : 'karigar owes shop'}
        </Pill>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 'var(--t-2xl)',
          color: shopOwes ? 'var(--accent-press)' : 'var(--neg)',
          fontWeight: 500,
        }}>
          <Rupee paise={Math.abs(paise)} />
        </span>
      </div>
    </Sheet>
  );
}

function InlineAlert({ message, onDismiss }: { message: string; onDismiss?: () => void }) {
  return (
    <div className="alert">
      <span style={{ whiteSpace: 'pre-wrap' }}>{message}</span>
      {onDismiss && <button className="alert__dismiss" onClick={onDismiss} aria-label="dismiss">×</button>}
    </div>
  );
}
