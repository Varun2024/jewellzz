/* Purchase register — read-only index of posted purchases.
 * Filter by date range + supplier. The backend `purchasesList` IPC already
 * exists; this is UI only. See phases.md §3-#11.
 */

import { useMemo, useState } from 'react';
import { CH, invoke } from '@/lib/ipc';
import { useAsync } from '@/lib/useAsync';
import type { Party } from '@shared/ipc';
import {
  Sheet, Field, Rupee, Num, Pill, Progress, Empty,
} from '@/components/ui';
import { fmtDate } from '@/features/jobs/shared';
import { useAnimatedNumber } from '@/lib/useAnimatedNumber';

type Row = {
  id: number;
  refNo: string;
  ts: number;
  partyId: number;
  partyName: string;
  subtotalPaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  totalPaise: number;
  balancePaise: number;
};

function toTs(v: string): number | undefined {
  if (!v) return undefined;
  const d = new Date(v);
  return isNaN(d.getTime()) ? undefined : Math.floor(d.getTime() / 1000);
}

export function PurchaseRegister() {
  const [from, setFrom] = useState('');
  const [to,   setTo]   = useState('');
  const [partyId, setPartyId] = useState<number | ''>('');

  const parties = useAsync<Party[]>(() => invoke(CH.partiesList));
  const suppliers = useMemo(
    () => (parties.data ?? []).filter((p) => p.role === 'supplier' || p.role === 'both'),
    [parties.data],
  );

  const rows = useAsync<Row[]>(
    () => invoke(CH.purchasesList, {
      fromTs:  toTs(from),
      toTs:    toTs(to),
      partyId: partyId === '' ? undefined : partyId,
    }),
    [from, to, partyId],
  );

  const totals = useMemo(() => {
    const list = rows.data ?? [];
    return {
      count: list.length,
      total:   list.reduce((s, r) => s + r.totalPaise,   0),
      balance: list.reduce((s, r) => s + r.balancePaise, 0),
      gst:     list.reduce((s, r) => s + r.cgstPaise + r.sgstPaise + r.igstPaise, 0),
    };
  }, [rows.data]);

  // Smooth count-up on the header totals when filters change the result set.
  const liveTotal   = useAnimatedNumber(totals.total,   420);
  const liveBalance = useAnimatedNumber(totals.balance, 420);
  const liveGst     = useAnimatedNumber(totals.gst,     420);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s4)' }}>

      <Sheet title="Filters">
        <div style={{ display: 'grid', gridTemplateColumns: '160px 160px 1fr 120px', gap: 'var(--s3)', alignItems: 'end' }}>
          <Field label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <Field label="To"   type="date" value={to}   onChange={(e) => setTo(e.target.value)} />
          <div className="field">
            <label className="field__label">Supplier</label>
            <select
              className="input"
              value={partyId}
              onChange={(e) => setPartyId(e.target.value === '' ? '' : Number(e.target.value))}
              disabled={parties.loading}
            >
              <option value="">all suppliers</option>
              {suppliers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <div style={{
              fontSize: 'var(--t-sm)', color: 'var(--text-mute)',
              textTransform: 'uppercase', letterSpacing: '0.04em',
            }}>Entries</div>
            <div style={{ fontSize: 'var(--t-lg)' }}><Num value={totals.count} /></div>
          </div>
        </div>
      </Sheet>

      {rows.error && (
        <div className="alert">
          <span style={{ whiteSpace: 'pre-wrap' }}>{rows.error}</span>
          <button className="alert__dismiss" onClick={() => rows.reload()} aria-label="retry">↻</button>
        </div>
      )}

      <Sheet
        title="Purchases"
        action={
          <div style={{
            display: 'inline-flex', alignItems: 'baseline', gap: 'var(--s3)',
            fontSize: 'var(--t-sm)', color: 'var(--text-mute)',
          }}>
            <span>GST <Rupee paise={liveGst} /></span>
            <span>·</span>
            <span>Total <Rupee paise={liveTotal} /></span>
            <span>·</span>
            <span>Due <Rupee paise={liveBalance} /></span>
          </div>
        }
        flush
      >
        {rows.loading ? <div style={{ padding: 12 }}><Progress /></div>
          : (rows.data?.length ?? 0) === 0 ? (
            <Empty mark="bell" title="No purchases in range">
              Adjust the date range or supplier filter — or post one from the <b>New</b> tab.
            </Empty>
          )
          : (
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 140 }}>Ref</th>
                  <th style={{ width: 90 }}>Date</th>
                  <th>Supplier</th>
                  <th className="num" style={{ width: 130 }}>Taxable</th>
                  <th className="num" style={{ width: 110 }}>GST</th>
                  <th className="num" style={{ width: 140 }}>Total</th>
                  <th className="num" style={{ width: 130 }}>Balance</th>
                  <th style={{ width: 90 }} />
                </tr>
              </thead>
              <tbody>
                {(rows.data ?? []).map((r) => {
                  const gst = r.cgstPaise + r.sgstPaise + r.igstPaise;
                  const settled = r.balancePaise === 0;
                  return (
                    <tr key={r.id}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-sm)' }}>
                        {r.refNo}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-xs)', color: 'var(--text-mute)' }}>
                        {fmtDate(r.ts)}
                      </td>
                      <td>{r.partyName}</td>
                      <td className="num"><Rupee paise={r.subtotalPaise} /></td>
                      <td className="num">
                        {gst > 0 ? <Rupee paise={gst} /> : <span style={{ color: 'var(--text-faint)' }}>—</span>}
                      </td>
                      <td className="num"><Rupee paise={r.totalPaise} /></td>
                      <td className="num">
                        {settled
                          ? <span style={{ color: 'var(--text-faint)' }}>—</span>
                          : <span style={{ color: 'var(--neg)' }}><Rupee paise={r.balancePaise} /></span>}
                      </td>
                      <td>
                        <Pill tone={settled ? 'pos' : 'accent'}>
                          {settled ? 'settled' : 'due'}
                        </Pill>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
      </Sheet>

      <div style={{ fontSize: 'var(--t-xs)', color: 'var(--text-faint)' }}>
        Showing most-recent 500 entries. Narrow the date range for faster filtering.
      </div>
    </div>
  );
}
