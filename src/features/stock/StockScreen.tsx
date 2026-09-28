import { useEffect, useState } from 'react';
import { CH, invoke } from '@/lib/ipc';
import { useAsync, useMutation } from '@/lib/useAsync';
import { fmtGrams, fmtCarat, gramsToMg, caratToMg } from '@/lib/format';
import { ErrorBanner, LoadingBlock, EmptyState, Spinner } from '@/components/Status';
import { CategoryBadge } from '@/components/CategoryBadge';
import type { Item } from '@shared/ipc';

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

  // when list reloads (after mutation), refresh selected reference
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
    <div className="grid grid-cols-2 gap-6 max-w-6xl">
      <div>
        <h3 className="text-sm font-medium mb-2">Stock register</h3>
        {list.error && <ErrorBanner message={list.error} onDismiss={() => list.reload()} />}
        {list.loading ? <LoadingBlock label="loading items…" /> : (
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-muted">
              <tr>
                <th className="py-1 pr-2">SKU</th><th className="pr-2">Name</th>
                <th className="pr-2 text-right">Qty</th><th className="pr-2 text-right">Weight</th>
              </tr>
            </thead>
            <tbody>
              {(list.data ?? []).map((it) => (
                <tr
                  key={it.id}
                  onClick={() => pick(it)}
                  className={`border-b border-border/50 cursor-pointer hover:bg-[var(--bg-hover)] ${
                    selected?.id === it.id ? 'bg-[var(--bg-hover)]' : ''
                  }`}
                >
                  <td className="py-1 pr-2 mono">{it.sku}</td>
                  <td className="pr-2">{it.name}</td>
                  <td className="pr-2 text-right mono">{it.stockQty}</td>
                  <td className="pr-2 text-right mono">
                    {it.unit === 'carat' ? fmtCarat(it.stockWtMg) : fmtGrams(it.stockWtMg)}
                  </td>
                </tr>
              ))}
              {(list.data?.length ?? 0) === 0 && <tr><td colSpan={4}><EmptyState>no items</EmptyState></td></tr>}
            </tbody>
          </table>
        )}
      </div>

      <div className="space-y-4">
        {!selected && <p className="text-muted text-sm">select an item to adjust stock</p>}
        {selected && (
          <>
            <div className="bg-panel border border-border rounded p-3 text-sm space-y-1">
              <div className="font-medium">{selected.name}</div>
              <div className="flex items-center gap-2">
                <CategoryBadge category={selected.category} stamp={selected.stamp} size="md" />
                <span className="text-muted mono text-xs">{selected.sku}</span>
              </div>
            </div>
            <form onSubmit={submit} className="space-y-2">
              <label className="text-xs text-muted flex flex-col gap-1">
                Δ qty (pcs; +add / −remove)
                <input type="number" step="1" className="input mono" value={dQty} onChange={(e) => setDQty(Number(e.target.value) || 0)} />
              </label>
              <label className="text-xs text-muted flex flex-col gap-1">
                Δ weight ({selected.unit === 'carat' ? 'carat' : 'grams'})
                <input type="number" step="0.001" className="input mono" value={dWt} onChange={(e) => setDWt(Number(e.target.value) || 0)} />
              </label>
              <label className="text-xs text-muted flex flex-col gap-1">
                Reason
                <input required className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="physical count, breakage, transfer..." />
              </label>
              <div className="flex gap-2 items-center">
                <button type="submit" className="btn-primary" disabled={adjust.loading}>
                  {adjust.loading ? <Spinner label="posting…" /> : 'Post adjustment'}
                </button>
              </div>
              {adjust.error && <ErrorBanner message={adjust.error} onDismiss={adjust.clearError} />}
            </form>

            <div>
              <h4 className="text-xs text-muted mb-1">history</h4>
              {histErr && <ErrorBanner message={histErr} onDismiss={() => setHistErr(null)} />}
              {histLoading ? <Spinner label="loading…" /> : (
                <table className="w-full text-xs">
                  <thead className="border-b border-border text-left text-muted">
                    <tr>
                      <th className="py-1 pr-2">When</th>
                      <th className="pr-2 text-right">Δ qty</th>
                      <th className="pr-2 text-right">Δ wt</th>
                      <th className="pr-2">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((h) => (
                      <tr key={h.id} className="border-b border-border/50">
                        <td className="py-1 pr-2 mono">{new Date(h.ts * 1000).toLocaleString('en-IN')}</td>
                        <td className="pr-2 text-right mono">{h.deltaQty}</td>
                        <td className="pr-2 text-right mono">
                          {selected.unit === 'carat' ? fmtCarat(h.deltaWtMg) : fmtGrams(h.deltaWtMg)}
                        </td>
                        <td className="pr-2">{h.reason}</td>
                      </tr>
                    ))}
                    {history.length === 0 && <tr><td colSpan={4}><EmptyState>no adjustments</EmptyState></td></tr>}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
