/* Karigars list + add/edit form — ported to v2 primitives. */

import { useState } from 'react';
import { CH, invoke } from '@/lib/ipc';
import { useAsync, useMutation } from '@/lib/useAsync';
import type { Karigar, KarigarInput } from '@shared/ipc';
import {
  Sheet, Button, Field, Rupee, Weight, Progress, Empty,
} from '@/components/ui';

type Balance = { id: number; name: string; phone: string | null; cashBalance: number; metalBalanceMg: number };

const EMPTY: KarigarInput & { id?: number } = {
  name: '', phone: '', address: '',
  defaultLabourMode: 'per_gram', defaultLabourValue: 0,
  notes: '',
};

const MODES = ['pct', 'per_gram', 'per_pcs'] as const;

export function KarigarsTab() {
  const bals = useAsync<Balance[]>(() => invoke(CH.karigarBalances));
  const [form, setForm] = useState<typeof EMPTY>(EMPTY);
  const [editingId, setEditingId] = useState<number | null>(null);
  const save = useMutation<KarigarInput & { id?: number }, Karigar>(async (p) => {
    if (p.id) return invoke(CH.karigarsUpdate, p);
    return invoke(CH.karigarsCreate, p);
  });
  const del = useMutation<number, { ok: boolean }>((id) => invoke(CH.karigarsDelete, { id }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await save.run({ ...form, id: editingId ?? undefined });
      setForm(EMPTY); setEditingId(null);
      await bals.reload();
    } catch { /* surfaced */ }
  }

  function edit(k: Balance) {
    invoke<Karigar[]>(CH.karigarsList).then((list) => {
      const full = list.find((x) => x.id === k.id);
      if (!full) return;
      setEditingId(full.id);
      setForm({
        name: full.name, phone: full.phone ?? '', address: full.address,
        defaultLabourMode: full.defaultLabourMode, defaultLabourValue: full.defaultLabourValue,
        notes: full.notes,
      });
      save.clearError();
    });
  }

  async function onDel(k: Balance) {
    if (!confirm(`Delete ${k.name}?`)) return;
    try { await del.run(k.id); await bals.reload(); } catch { /* surfaced */ }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s4)' }}>
      <Sheet title={editingId ? 'Edit karigar' : 'New karigar'}>
        <form onSubmit={submit} style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 'var(--s3)' }}>
          <div style={{ gridColumn: 'span 2' }}>
            <Field label="Name" required value={form.name}
                   onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <Field label="Phone" value={form.phone ?? ''}
                 onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <div style={{ gridColumn: 'span 3' }}>
            <Field label="Address" value={form.address}
                   onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
          <div>
            <div className="field">
              <label className="field__label">Labour mode</label>
              <select className="input" value={form.defaultLabourMode}
                      onChange={(e) => setForm({ ...form, defaultLabourMode: e.target.value as Karigar['defaultLabourMode'] })}>
                {MODES.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>
          <Field
            label={form.defaultLabourMode === 'pct' ? 'Default labour %' : 'Default labour ₹'}
            numeric type="number" step="0.01"
            value={form.defaultLabourValue / 100}
            onChange={(e) => setForm({ ...form, defaultLabourValue: Math.round(Number(e.target.value) * 100) })}
          />
          <div style={{ gridColumn: 'span 4' }}>
            <Field label="Notes" value={form.notes}
                   onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div style={{ gridColumn: 'span 6', display: 'flex', gap: 'var(--s2)', alignItems: 'center' }}>
            <Button variant="primary" type="submit" disabled={save.loading}>
              {save.loading ? (editingId ? 'Updating…' : 'Adding…') : (editingId ? 'Update' : 'Add karigar')}
            </Button>
            {editingId && (
              <Button type="button" onClick={() => { setEditingId(null); setForm(EMPTY); save.clearError(); }}>
                Cancel
              </Button>
            )}
            {save.error && <InlineAlert message={save.error} onDismiss={save.clearError} />}
          </div>
        </form>
      </Sheet>

      {del.error && <InlineAlert message={del.error} onDismiss={del.clearError} />}
      {bals.error && <InlineAlert message={bals.error} onDismiss={() => bals.reload()} />}

      <Sheet title="Karigars" flush>
        {bals.loading ? <div style={{ padding: 12 }}><Progress /></div>
          : (bals.data?.length ?? 0) === 0 ? <Empty mark="shop" title="No karigars yet — add one to open the workshop" />
          : (
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th style={{ width: 140 }}>Phone</th>
                  <th className="num" style={{ width: 160 }}>Cash balance</th>
                  <th className="num" style={{ width: 140 }}>Metal balance</th>
                  <th style={{ width: 120 }} />
                </tr>
              </thead>
              <tbody>
                {(bals.data ?? []).map((k) => (
                  <tr key={k.id}>
                    <td>{k.name}</td>
                    <td style={{ fontSize: 'var(--t-sm)', color: 'var(--text-mute)' }}>{k.phone ?? ''}</td>
                    <td className="num">
                      <span style={{ color: k.cashBalance < 0 ? 'var(--neg)' : undefined }}>
                        <Rupee paise={k.cashBalance} />
                      </span>
                    </td>
                    <td className="num">
                      {k.metalBalanceMg
                        ? <span style={{ color: k.metalBalanceMg > 0 ? 'var(--accent-press)' : undefined }}>
                            <Weight mg={k.metalBalanceMg} />
                          </span>
                        : <span style={{ color: 'var(--text-faint)' }}>—</span>}
                    </td>
                    <td className="num">
                      <div style={{ display: 'inline-flex', gap: 'var(--s2)' }}>
                        <Button variant="link" onClick={() => edit(k)}>edit</Button>
                        <Button variant="link" onClick={() => onDel(k)} disabled={del.loading} style={{ color: 'var(--neg)' }}>
                          del
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </Sheet>

      <div style={{ fontSize: 'var(--t-xs)', color: 'var(--text-faint)' }}>
        Cash balance: negative = shop owes labour to karigar. Metal balance: positive = karigar owes metal to shop (open issue slip pending receipt).
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
