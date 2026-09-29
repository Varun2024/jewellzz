import { useState } from 'react';
import { CH, invoke } from '@/lib/ipc';
import { useAsync, useMutation } from '@/lib/useAsync';
import { fmtGrams, gramsToMg, caratToMg } from '@/lib/format';
import { ErrorBanner, LoadingBlock, EmptyState, Spinner } from '@/components/Status';
import type { Karigar } from '@shared/ipc';

type Cat = 'gold' | 'silver' | 'stone' | 'artificial';
type Line = { key: string; category: Cat; stamp: string; weight: number; unit: 'g' | 'ct'; note: string };

const CATEGORIES: Cat[] = ['gold', 'silver', 'stone', 'artificial'];

export function IssueTab() {
  const karigars = useAsync<Karigar[]>(() => invoke(CH.karigarsList));
  const issues = useAsync<any[]>(() => invoke(CH.karigarIssuesList, {}));

  const [karigarId, setKarigarId] = useState<number | null>(null);
  const [purpose, setPurpose] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<Line[]>([]);
  const [err, setErr] = useState('');
  const post = useMutation<any, { id: number; slipNo: string }>((p) => invoke(CH.karigarIssuePost, p));

  function addLine() {
    setLines((ls) => [...ls, { key: `${Date.now()}-${ls.length}`, category: 'gold', stamp: '22k', weight: 0, unit: 'g', note: '' }]);
  }
  function upd(k: string, patch: Partial<Line>) {
    setLines((ls) => ls.map((l) => l.key === k ? { ...l, ...patch } : l));
  }
  function del(k: string) {
    setLines((ls) => ls.filter((l) => l.key !== k));
  }

  async function submit() {
    setErr(''); post.clearError();
    if (!karigarId) return setErr('pick a karigar');
    if (lines.length === 0) return setErr('add at least one line');
    if (lines.some((l) => l.weight <= 0)) return setErr('every line needs a positive weight');
    try {
      const payload = {
        karigarId, purpose, notes,
        lines: lines.map((l) => ({
          category: l.category,
          stamp: l.category === 'gold' || l.category === 'silver' ? l.stamp : '',
          weightMg: l.unit === 'ct' ? caratToMg(l.weight) : gramsToMg(l.weight),
          note: l.note,
        })),
      };
      const r = await post.run(payload);
      setLines([]); setPurpose(''); setNotes('');
      await issues.reload();
      setErr(''); setLastOk(`issued ${r.slipNo}`);
    } catch { /* surfaced via post.error */ }
  }

  const [lastOk, setLastOk] = useState('');

  return (
    <div className="grid grid-cols-2 gap-6">
      <div className="space-y-3">
        <h3 className="text-sm font-medium">New issue slip</h3>
        {karigars.error && <ErrorBanner message={karigars.error} onDismiss={() => karigars.reload()} />}
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs text-muted">Karigar
            <select className="input w-full" value={karigarId ?? ''} onChange={(e) => setKarigarId(Number(e.target.value) || null)} disabled={karigars.loading}>
              <option value="">{karigars.loading ? 'loading…' : '— pick —'}</option>
              {(karigars.data ?? []).map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
            </select>
          </label>
          <label className="text-xs text-muted">Purpose
            <input className="input w-full" value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="ring casting, chain repair…" />
          </label>
        </div>

        <div className="flex justify-between items-center">
          <div className="text-xs text-muted">metal lines</div>
          <button type="button" className="btn text-xs" onClick={addLine}>+ add line</button>
        </div>

        <table className="w-full text-xs">
          <thead className="text-muted border-b border-border">
            <tr>
              <th className="text-left py-1">Category</th>
              <th className="text-left">Stamp</th>
              <th className="text-right">Weight</th>
              <th className="text-left">Unit</th>
              <th className="text-left">Note</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.key} className="border-b border-border/50">
                <td>
                  <select className="input" value={l.category} onChange={(e) => upd(l.key, { category: e.target.value as Cat })}>
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </td>
                <td>
                  <input className="input w-20 mono" value={l.stamp} onChange={(e) => upd(l.key, { stamp: e.target.value })}
                         disabled={l.category !== 'gold' && l.category !== 'silver'} placeholder="—" />
                </td>
                <td className="text-right">
                  <input className="input w-24 text-right mono" type="number" step="0.001"
                         value={l.weight} onChange={(e) => upd(l.key, { weight: Number(e.target.value) || 0 })} />
                </td>
                <td>
                  <select className="input" value={l.unit} onChange={(e) => upd(l.key, { unit: e.target.value as any })}>
                    <option value="g">g</option><option value="ct">ct</option>
                  </select>
                </td>
                <td><input className="input" value={l.note} onChange={(e) => upd(l.key, { note: e.target.value })} /></td>
                <td className="text-right"><button className="link text-danger" onClick={() => del(l.key)}>×</button></td>
              </tr>
            ))}
            {lines.length === 0 && <tr><td colSpan={6}><EmptyState>no lines — add one</EmptyState></td></tr>}
          </tbody>
        </table>

        <label className="text-xs text-muted flex flex-col gap-1">Notes
          <input className="input w-full" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>

        <div className="flex gap-2 items-center">
          <button className="btn-primary" onClick={submit} disabled={post.loading}>
            {post.loading ? <Spinner label="posting…" /> : 'Post issue slip'}
          </button>
          {err && <ErrorBanner message={err} onDismiss={() => setErr('')} />}
          {post.error && <ErrorBanner message={post.error} onDismiss={post.clearError} />}
          {lastOk && !err && !post.error && <div className="text-success text-xs">{lastOk}</div>}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium mb-2">Recent issues</h3>
        {issues.error && <ErrorBanner message={issues.error} onDismiss={() => issues.reload()} />}
        {issues.loading ? <LoadingBlock label="loading…" /> : (
          <table className="w-full text-xs">
            <thead className="text-muted border-b border-border">
              <tr>
                <th className="text-left py-1">Slip</th>
                <th className="text-left">When</th>
                <th className="text-left">Karigar</th>
                <th className="text-right">Weight</th>
                <th className="text-left">Purpose</th>
              </tr>
            </thead>
            <tbody>
              {(issues.data ?? []).map((i) => (
                <tr key={i.id} className="border-b border-border/50">
                  <td className="py-1 mono">{i.slipNo}</td>
                  <td className="mono">{new Date(i.ts * 1000).toLocaleString('en-IN')}</td>
                  <td>{i.karigarName}</td>
                  <td className="text-right mono">{fmtGrams(i.totalMg ?? 0)}</td>
                  <td className="text-muted">{i.purpose}</td>
                </tr>
              ))}
              {(issues.data?.length ?? 0) === 0 && <tr><td colSpan={5}><EmptyState>no issues yet</EmptyState></td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
