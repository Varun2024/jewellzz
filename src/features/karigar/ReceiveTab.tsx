import { useEffect, useState } from 'react';
import { CH, invoke } from '@/lib/ipc';
import { useAsync, useMutation } from '@/lib/useAsync';
import { fmtGrams, fmtPaise, gramsToMg, caratToMg, rupeesToPaise } from '@/lib/format';
import { ErrorBanner, LoadingBlock, EmptyState, Spinner } from '@/components/Status';
import type { Karigar, Item } from '@shared/ipc';

type Cat = 'gold' | 'silver' | 'stone' | 'artificial';
type Line = {
  key: string;
  itemId: number | null;
  category: Cat;
  stamp: string;
  qty: number;
  weight: number;
  wastage: number;
  unit: 'g' | 'ct';
  note: string;
};

const CATEGORIES: Cat[] = ['gold', 'silver', 'stone', 'artificial'];

export function ReceiveTab() {
  const karigars = useAsync<Karigar[]>(() => invoke(CH.karigarsList));
  const items = useAsync<Item[]>(() => invoke(CH.itemsList));
  const receipts = useAsync<any[]>(() => invoke(CH.karigarReceiptsList, {}));

  const [karigarId, setKarigarId] = useState<number | null>(null);
  const [openIssues, setOpenIssues] = useState<any[]>([]);
  const [relatedIssueId, setRelatedIssueId] = useState<number | null>(null);
  const [labour, setLabour] = useState(0);   // rupees
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<Line[]>([]);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const post = useMutation<any, { id: number; slipNo: string }>((p) => invoke(CH.karigarReceiptPost, p));
  const pay = useMutation<any, { id: number }>((p) => invoke(CH.karigarPay, p));

  useEffect(() => {
    if (!karigarId) { setOpenIssues([]); return; }
    invoke<any[]>(CH.karigarIssuesList, { karigarId }).then(setOpenIssues).catch(() => setOpenIssues([]));
  }, [karigarId]);

  function addLine() {
    setLines((ls) => [...ls, {
      key: `${Date.now()}-${ls.length}`,
      itemId: null, category: 'gold', stamp: '22k',
      qty: 0, weight: 0, wastage: 0, unit: 'g', note: '',
    }]);
  }
  function upd(k: string, patch: Partial<Line>) {
    setLines((ls) => ls.map((l) => l.key === k ? { ...l, ...patch } : l));
  }
  function del(k: string) { setLines((ls) => ls.filter((l) => l.key !== k)); }

  async function submit() {
    setErr(''); setOk(''); post.clearError();
    if (!karigarId) return setErr('pick a karigar');
    if (lines.length === 0) return setErr('add at least one line');
    try {
      const payload = {
        karigarId,
        relatedIssueId: relatedIssueId ?? null,
        labourPaise: rupeesToPaise(labour),
        notes,
        lines: lines.map((l) => ({
          itemId: l.itemId,
          category: l.category,
          stamp: l.category === 'gold' || l.category === 'silver' ? l.stamp : '',
          qty: Math.round(l.qty),
          weightMg: l.unit === 'ct' ? caratToMg(l.weight) : gramsToMg(l.weight),
          wastageMg: l.unit === 'ct' ? caratToMg(l.wastage) : gramsToMg(l.wastage),
          note: l.note,
        })),
      };
      const r = await post.run(payload);
      setLines([]); setLabour(0); setNotes(''); setRelatedIssueId(null);
      await Promise.all([receipts.reload(), items.reload()]);
      setOk(`received ${r.slipNo}`);
    } catch { /* surfaced */ }
  }

  async function payNow(amount: number) {
    if (!karigarId) return;
    try {
      await pay.run({ karigarId, amountPaise: rupeesToPaise(amount), note: 'labour payment' });
      setOk('paid');
    } catch { /* surfaced via pay.error */ }
  }

  return (
    <div className="grid grid-cols-2 gap-6">
      <div className="space-y-3">
        <h3 className="text-sm font-medium">New receipt slip</h3>
        {karigars.error && <ErrorBanner message={karigars.error} onDismiss={() => karigars.reload()} />}

        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs text-muted">Karigar
            <select className="input w-full" value={karigarId ?? ''} onChange={(e) => setKarigarId(Number(e.target.value) || null)} disabled={karigars.loading}>
              <option value="">{karigars.loading ? 'loading…' : '— pick —'}</option>
              {(karigars.data ?? []).map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
            </select>
          </label>
          <label className="text-xs text-muted">Related issue (optional)
            <select className="input w-full" value={relatedIssueId ?? ''} onChange={(e) => setRelatedIssueId(Number(e.target.value) || null)} disabled={!karigarId}>
              <option value="">— none —</option>
              {openIssues.map((i) => <option key={i.id} value={i.id}>{i.slipNo} · {fmtGrams(i.totalMg ?? 0)}</option>)}
            </select>
          </label>
        </div>

        <div className="flex justify-between items-center">
          <div className="text-xs text-muted">received lines</div>
          <button type="button" className="btn text-xs" onClick={addLine}>+ add line</button>
        </div>

        <table className="w-full text-xs">
          <thead className="text-muted border-b border-border">
            <tr>
              <th className="text-left py-1">Item (opt)</th>
              <th className="text-left">Cat</th>
              <th className="text-left">Stamp</th>
              <th className="text-right">Qty</th>
              <th className="text-right">Weight</th>
              <th className="text-right">Wastage</th>
              <th className="text-left">Unit</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.key} className="border-b border-border/50">
                <td>
                  <select className="input" value={l.itemId ?? ''} onChange={(e) => {
                    const id = Number(e.target.value) || null;
                    const it = items.data?.find((x) => x.id === id);
                    upd(l.key, {
                      itemId: id,
                      category: it?.category ?? l.category,
                      stamp: it?.stamp ?? l.stamp,
                      unit: it?.unit === 'carat' ? 'ct' : 'g',
                    });
                  }}>
                    <option value="">— none —</option>
                    {(items.data ?? []).map((i) => <option key={i.id} value={i.id}>{i.sku} — {i.name}</option>)}
                  </select>
                </td>
                <td>
                  <select className="input" value={l.category} onChange={(e) => upd(l.key, { category: e.target.value as Cat })} disabled={!!l.itemId}>
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </td>
                <td>
                  <input className="input w-16 mono" value={l.stamp} onChange={(e) => upd(l.key, { stamp: e.target.value })}
                         disabled={l.category !== 'gold' && l.category !== 'silver'} />
                </td>
                <td className="text-right"><input className="input w-14 text-right mono" type="number" value={l.qty} onChange={(e) => upd(l.key, { qty: Number(e.target.value) || 0 })} /></td>
                <td className="text-right"><input className="input w-20 text-right mono" type="number" step="0.001" value={l.weight} onChange={(e) => upd(l.key, { weight: Number(e.target.value) || 0 })} /></td>
                <td className="text-right"><input className="input w-20 text-right mono" type="number" step="0.001" value={l.wastage} onChange={(e) => upd(l.key, { wastage: Number(e.target.value) || 0 })} /></td>
                <td>
                  <select className="input" value={l.unit} onChange={(e) => upd(l.key, { unit: e.target.value as any })}>
                    <option value="g">g</option><option value="ct">ct</option>
                  </select>
                </td>
                <td className="text-right"><button className="link text-danger" onClick={() => del(l.key)}>×</button></td>
              </tr>
            ))}
            {lines.length === 0 && <tr><td colSpan={8}><EmptyState>no lines — add one</EmptyState></td></tr>}
          </tbody>
        </table>

        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs text-muted">Labour claim ₹
            <input type="number" step="0.01" className="input w-full mono" value={labour} onChange={(e) => setLabour(Number(e.target.value) || 0)} />
          </label>
          <label className="text-xs text-muted">Notes
            <input className="input w-full" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
        </div>

        <div className="flex gap-2 items-center flex-wrap">
          <button className="btn-primary" onClick={submit} disabled={post.loading}>
            {post.loading ? <Spinner label="posting…" /> : 'Post receipt slip'}
          </button>
          <button className="btn" onClick={() => payNow(labour)} disabled={pay.loading || !karigarId || labour <= 0}>
            {pay.loading ? <Spinner label="paying…" /> : `Pay ₹${labour.toFixed(2)} now`}
          </button>
          {err && <ErrorBanner message={err} onDismiss={() => setErr('')} />}
          {post.error && <ErrorBanner message={post.error} onDismiss={post.clearError} />}
          {pay.error && <ErrorBanner message={pay.error} onDismiss={pay.clearError} />}
          {ok && !err && !post.error && !pay.error && <div className="text-success text-xs">{ok}</div>}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium mb-2">Recent receipts</h3>
        {receipts.error && <ErrorBanner message={receipts.error} onDismiss={() => receipts.reload()} />}
        {receipts.loading ? <LoadingBlock label="loading…" /> : (
          <table className="w-full text-xs">
            <thead className="text-muted border-b border-border">
              <tr>
                <th className="text-left py-1">Slip</th>
                <th className="text-left">When</th>
                <th className="text-left">Karigar</th>
                <th className="text-right">Received</th>
                <th className="text-right">Wastage</th>
                <th className="text-right">Labour</th>
              </tr>
            </thead>
            <tbody>
              {(receipts.data ?? []).map((r) => (
                <tr key={r.id} className="border-b border-border/50">
                  <td className="py-1 mono">{r.slipNo}</td>
                  <td className="mono">{new Date(r.ts * 1000).toLocaleString('en-IN')}</td>
                  <td>{r.karigarName}</td>
                  <td className="text-right mono">{fmtGrams(r.totalReceivedMg ?? 0)}</td>
                  <td className="text-right mono">{fmtGrams(r.totalWastageMg ?? 0)}</td>
                  <td className="text-right mono">{fmtPaise(r.labourPaise)}</td>
                </tr>
              ))}
              {(receipts.data?.length ?? 0) === 0 && <tr><td colSpan={6}><EmptyState>no receipts yet</EmptyState></td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
