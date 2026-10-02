/* Issue slip — ported to v2 primitives. */

import { useState } from 'react';
import { CH, invoke } from '@/lib/ipc';
import { useAsync, useMutation } from '@/lib/useAsync';
import { gramsToMg, caratToMg } from '@/lib/format';
import type { Karigar } from '@shared/ipc';
import {
  Sheet, Button, Field, Weight, Pill, Progress, Empty,
} from '@/components/ui';

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
  const [lastOk, setLastOk] = useState('');
  const post = useMutation<any, { id: number; slipNo: string }>((p) => invoke(CH.karigarIssuePost, p));

  function addLine() {
    setLines((ls) => [...ls, { key: `${Date.now()}-${ls.length}`, category: 'gold', stamp: '22k', weight: 0, unit: 'g', note: '' }]);
  }
  function upd(k: string, patch: Partial<Line>) {
    setLines((ls) => ls.map((l) => l.key === k ? { ...l, ...patch } : l));
  }
  function del(k: string) { setLines((ls) => ls.filter((l) => l.key !== k)); }

  async function submit() {
    setErr(''); post.clearError();
    if (!karigarId)           return setErr('pick a karigar');
    if (lines.length === 0)   return setErr('add at least one line');
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
      setLastOk(`issued ${r.slipNo}`);
    } catch { /* surfaced */ }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--s4)' }}>

      <Sheet title="New issue slip">
        {karigars.error && <InlineAlert message={karigars.error} onDismiss={() => karigars.reload()} />}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--s3)', marginBottom: 'var(--s3)' }}>
          <div className="field">
            <label className="field__label">Karigar</label>
            <select
              className="input"
              value={karigarId ?? ''}
              onChange={(e) => setKarigarId(Number(e.target.value) || null)}
              disabled={karigars.loading}
            >
              <option value="">{karigars.loading ? 'loading…' : '— pick —'}</option>
              {(karigars.data ?? []).map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
            </select>
          </div>
          <Field label="Purpose" value={purpose}
                 onChange={(e) => setPurpose(e.target.value)}
                 placeholder="ring casting, chain repair…" />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--s2)' }}>
          <div style={{
            fontSize: 'var(--t-sm)', color: 'var(--text-mute)',
            textTransform: 'uppercase', letterSpacing: '0.04em',
          }}>Metal lines</div>
          <Button type="button" onClick={addLine}>+ add line</Button>
        </div>

        <table className="table" style={{ marginBottom: 'var(--s3)' }}>
          <thead>
            <tr>
              <th>Category</th>
              <th style={{ width: 80 }}>Stamp</th>
              <th className="num" style={{ width: 100 }}>Weight</th>
              <th style={{ width: 60 }}>Unit</th>
              <th>Note</th>
              <th style={{ width: 28 }} />
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.key}>
                <td>
                  <select
                    className="input"
                    style={{ height: 24, fontSize: 'var(--t-sm)' }}
                    value={l.category}
                    onChange={(e) => upd(l.key, { category: e.target.value as Cat })}
                  >
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </td>
                <td>
                  <input
                    className="input"
                    style={{ height: 24, width: 60, fontFamily: 'var(--font-mono)' }}
                    value={l.stamp}
                    onChange={(e) => upd(l.key, { stamp: e.target.value })}
                    disabled={l.category !== 'gold' && l.category !== 'silver'}
                    placeholder="—"
                  />
                </td>
                <td className="num">
                  <input
                    className="input input--num"
                    style={{ width: 90, height: 24 }}
                    type="number" step="0.001"
                    value={l.weight}
                    onChange={(e) => upd(l.key, { weight: Number(e.target.value) || 0 })}
                  />
                </td>
                <td>
                  <select
                    className="input"
                    style={{ height: 24, width: 50, fontSize: 'var(--t-sm)' }}
                    value={l.unit}
                    onChange={(e) => upd(l.key, { unit: e.target.value as 'g' | 'ct' })}
                  >
                    <option value="g">g</option><option value="ct">ct</option>
                  </select>
                </td>
                <td>
                  <input
                    className="input"
                    style={{ height: 24 }}
                    value={l.note}
                    onChange={(e) => upd(l.key, { note: e.target.value })}
                  />
                </td>
                <td className="num">
                  <button
                    onClick={() => del(l.key)}
                    aria-label="remove"
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--text-faint)', fontSize: 16, lineHeight: 1,
                    }}
                  >×</button>
                </td>
              </tr>
            ))}
            {lines.length === 0 && (
              <tr><td colSpan={6} style={{ padding: 'var(--s4)' }}><Empty title="No lines — add one" /></td></tr>
            )}
          </tbody>
        </table>

        <Field label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />

        <div style={{ display: 'flex', gap: 'var(--s2)', alignItems: 'center', marginTop: 'var(--s3)', flexWrap: 'wrap' }}>
          <Button variant="primary" onClick={submit} disabled={post.loading}>
            {post.loading ? 'Posting…' : 'Post issue slip'}
          </Button>
          {err && <InlineAlert message={err} onDismiss={() => setErr('')} />}
          {post.error && <InlineAlert message={post.error} onDismiss={post.clearError} />}
          {lastOk && !err && !post.error && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Pill tone="pos">issued</Pill>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-sm)', color: 'var(--text-mute)' }}>{lastOk}</span>
            </span>
          )}
        </div>
      </Sheet>

      <Sheet title="Recent issues" flush>
        {issues.error && <div style={{ padding: 12 }}><InlineAlert message={issues.error} onDismiss={() => issues.reload()} /></div>}
        {issues.loading ? <div style={{ padding: 12 }}><Progress /></div>
          : (issues.data?.length ?? 0) === 0 ? <Empty mark="ledger" title="No issues yet" />
          : (
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 100 }}>Slip</th>
                  <th style={{ width: 150 }}>When</th>
                  <th>Karigar</th>
                  <th className="num" style={{ width: 110 }}>Weight</th>
                  <th>Purpose</th>
                </tr>
              </thead>
              <tbody>
                {(issues.data ?? []).map((i) => (
                  <tr key={i.id}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-sm)' }}>{i.slipNo}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-sm)', color: 'var(--text-mute)' }}>
                      {new Date(i.ts * 1000).toLocaleString('en-IN')}
                    </td>
                    <td>{i.karigarName}</td>
                    <td className="num"><Weight mg={i.totalMg ?? 0} /></td>
                    <td style={{ fontSize: 'var(--t-sm)', color: 'var(--text-mute)' }}>{i.purpose}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </Sheet>
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
