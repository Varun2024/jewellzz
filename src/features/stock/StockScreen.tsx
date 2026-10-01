/* Stock — register + adjustment form + history. Ported to v2 primitives. */

import { useEffect, useState } from 'react';
import { CH, invoke } from '@/lib/ipc';
import { useAsync, useMutation } from '@/lib/useAsync';
import { gramsToMg, caratToMg } from '@/lib/format';
import { CategoryBadge } from '@/components/CategoryBadge';
import type { Item } from '@shared/ipc';
import {
  Sheet, Button, Field, Num, Weight, Progress, Empty,
} from '@/components/ui';

type Adjustment = { id: number; ts: number; deltaQty: number; deltaWtMg: number; reason: string; actor: string };

export function StockScreen() {
  const list = useAsync<Item[]>(() => invoke(CH.itemsList));
  const [selected, setSelected] = useState<Item | null>(null);
  const [history, setHistory] = useState<Adjustment[]>([]);
  const [histLoading, setHistLoading] = useState(false);
  const [histErr, setHistErr] = useState<string | null>(null);
  const [dQty, setDQty] = useState(0);
  const [dWt, setDWt] = useState(0);
  const [reason, setReason] = useState('');

  const adjust = useMutation<{ itemId: number; deltaQty: number; deltaWtMg: number; reason: string }, Item>(
    (p) => invoke(CH.stockAdjust, p),
  );

  async function loadHistory(id: number) {
    setHistLoading(true); setHistErr(null);
    try {
      setHistory(await invoke<Adjustment[]>(CH.stockAdjustments, { itemId: id }));
    } catch (e: any) {
      setHistErr(e.message ?? String(e));
    } finally {
      setHistLoading(false);
    }
  }

  async function pick(it: Item) {
    setSelected(it);
    setDQty(0); setDWt(0); setReason('');
    adjust.clearError();
    await loadHistory(it.id);
  }

  useEffect(() => {
    if (!selected || !list.data) return;
    const s = list.data.find((i) => i.id === selected.id) ?? null;
    if (s && s !== selected) setSelected(s);
  }, [list.data, selected]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    try {
      const wtMg = selected.unit === 'carat' ? caratToMg(dWt) : gramsToMg(dWt);
      await adjust.run({
        itemId: selected.id,
        deltaQty: Math.round(dQty),
        deltaWtMg: wtMg,
        reason,
      });
      setDQty(0); setDWt(0); setReason('');
      await Promise.all([list.reload(), loadHistory(selected.id)]);
    } catch { /* surfaced */ }
  }

  return (
    <div className="ds-v2" style={{ padding: 'var(--container-pad)', height: '100%', boxSizing: 'border-box' }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 420px',
        gap: 'var(--s4)',
        height: '100%',
        minHeight: 0,
      }}>

        {/* register */}
        <div style={{ minWidth: 0, overflow: 'auto' }}>
          <Sheet title="Stock register" flush>
            {list.error && <div style={{ padding: 12 }}><InlineAlert message={list.error} onDismiss={() => list.reload()} /></div>}
            {list.loading ? <div style={{ padding: 12 }}><Progress /></div>
              : (list.data?.length ?? 0) === 0 ? <Empty mark="case" title="Nothing in the case yet" />
              : (
                <table className="table">
                  <thead>
                    <tr>
                      <th style={{ width: 110 }}>SKU</th>
                      <th>Name</th>
                      <th className="num" style={{ width: 70 }}>Qty</th>
                      <th className="num" style={{ width: 120 }}>Weight</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(list.data ?? []).map((it) => {
                      const active = selected?.id === it.id;
                      return (
                        <tr
                          key={it.id}
                          onClick={() => pick(it)}
                          style={{
                            cursor: 'pointer',
                            background: active ? 'var(--surface-hi)' : undefined,
                            boxShadow: active ? 'inset 2px 0 0 var(--accent)' : undefined,
                          }}
                        >
                          <td style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-sm)' }}>{it.sku}</td>
                          <td>{it.name}</td>
                          <td className="num"><Num value={it.stockQty} /></td>
                          <td className="num">
                            {it.stockWtMg
                              ? <Weight mg={it.stockWtMg} unit={it.unit === 'carat' ? 'ct' : 'g'} />
                              : <span style={{ color: 'var(--text-faint)' }}>—</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
          </Sheet>
        </div>

        {/* adjust pane */}
        <div style={{ overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--s3)' }}>
          {!selected && (
            <Sheet><Empty title="Select an item" >Click a row on the left to post an adjustment.</Empty></Sheet>
          )}
          {selected && (
            <>
              <Sheet title="Selected">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s2)' }}>
                  <div style={{ fontWeight: 500 }}>{selected.name}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s2)' }}>
                    <CategoryBadge category={selected.category} stamp={selected.stamp} size="md" />
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-sm)', color: 'var(--text-mute)' }}>
                      {selected.sku}
                    </span>
                  </div>
                </div>
              </Sheet>

              <Sheet title="Post adjustment">
                <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s3)' }}>
                  <Field
                    label="Δ qty (pcs; + add / − remove)"
                    numeric
                    type="number" step="1"
                    value={dQty}
                    onChange={(e) => setDQty(Number(e.target.value) || 0)}
                  />
                  <Field
                    label={`Δ weight (${selected.unit === 'carat' ? 'carat' : 'grams'})`}
                    numeric
                    type="number" step="0.001"
                    value={dWt}
                    onChange={(e) => setDWt(Number(e.target.value) || 0)}
                  />
                  <Field
                    label="Reason"
                    required
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="physical count, breakage, transfer…"
                  />
                  <div>
                    <Button variant="primary" type="submit" disabled={adjust.loading}>
                      {adjust.loading ? 'Posting…' : 'Post adjustment'}
                    </Button>
                  </div>
                  {adjust.error && <InlineAlert message={adjust.error} onDismiss={adjust.clearError} />}
                </form>
              </Sheet>

              <Sheet title="History" flush>
                {histErr && <div style={{ padding: 12 }}><InlineAlert message={histErr} onDismiss={() => setHistErr(null)} /></div>}
                {histLoading ? <div style={{ padding: 12 }}><Progress /></div>
                  : history.length === 0 ? <Empty mark="ledger" title="No adjustments yet" />
                  : (
                    <table className="table">
                      <thead>
                        <tr>
                          <th style={{ width: 150 }}>When</th>
                          <th className="num" style={{ width: 70 }}>Δ qty</th>
                          <th className="num" style={{ width: 110 }}>Δ wt</th>
                          <th>Reason</th>
                        </tr>
                      </thead>
                      <tbody>
                        {history.map((h) => (
                          <tr key={h.id}>
                            <td style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-sm)', color: 'var(--text-mute)' }}>
                              {new Date(h.ts * 1000).toLocaleString('en-IN')}
                            </td>
                            <td className="num">
                              <span style={{ color: h.deltaQty > 0 ? 'var(--pos)' : h.deltaQty < 0 ? 'var(--neg)' : undefined }}>
                                <Num value={h.deltaQty} signed />
                              </span>
                            </td>
                            <td className="num">
                              <span style={{ color: h.deltaWtMg > 0 ? 'var(--pos)' : h.deltaWtMg < 0 ? 'var(--neg)' : undefined }}>
                                <Weight mg={h.deltaWtMg} unit={selected.unit === 'carat' ? 'ct' : 'g'} />
                              </span>
                            </td>
                            <td style={{ fontSize: 'var(--t-sm)' }}>{h.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
              </Sheet>
            </>
          )}
        </div>
      </div>
    </div>
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
