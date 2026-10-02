/* Parties — form + list. Ported to v2 primitives. */

import { useState } from 'react';
import { CH, invoke } from '@/lib/ipc';
import { useAsync, useMutation } from '@/lib/useAsync';
import { rupeesToPaise, gramsToMg } from '@/lib/format';
import type { Party, PartyInput } from '@shared/ipc';
import {
  Sheet, Button, Field, Rupee, Weight, Pill, Progress, Empty, toast,
} from '@/components/ui';

const EMPTY: PartyInput & { id?: number } = {
  name: '', role: 'customer', gstin: '', phone: '',
  address: '', stateCode: '',
  openingCash: 0, openingMetalMg: 0,
};

export function PartiesScreen() {
  const list = useAsync<Party[]>(() => invoke(CH.partiesList));
  const [form, setForm] = useState<typeof EMPTY>(EMPTY);
  const [editingId, setEditingId] = useState<number | null>(null);
  const save = useMutation<PartyInput & { id?: number }, Party>(async (p) => {
    if (p.id) return invoke(CH.partiesUpdate, p);
    return invoke(CH.partiesCreate, p);
  });
  const del = useMutation<number, { ok: boolean }>((id) => invoke(CH.partiesDelete, { id }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await save.run({ ...form, id: editingId ?? undefined });
      if (editingId) {
        toast.success(`Updated ${res.name}`);
      } else {
        toast.success(`Added ${res.name}`, {
          action: { label: 'edit', onClick: () => edit(res) },
        });
      }
      setForm(EMPTY); setEditingId(null);
      await list.reload();
    } catch { /* surfaced */ }
  }

  function edit(p: Party) {
    setEditingId(p.id);
    setForm({
      name: p.name, role: p.role,
      gstin: p.gstin ?? '', phone: p.phone ?? '',
      address: p.address, stateCode: p.stateCode,
      openingCash: p.openingCash, openingMetalMg: p.openingMetalMg,
    });
    save.clearError();
  }

  async function onDel(p: Party) {
    if (!confirm(`Delete ${p.name}?`)) return;
    try {
      await del.run(p.id);
      toast.success(`Deleted ${p.name}`);
      await list.reload();
    } catch { /* surfaced */ }
  }

  return (
    <div className="ds-v2" style={{ padding: 'var(--container-pad)', height: '100%', overflow: 'auto', boxSizing: 'border-box' }}>
      <div style={{ maxWidth: 1100, display: 'flex', flexDirection: 'column', gap: 'var(--s4)' }}>

        <Sheet title={editingId ? 'Edit party' : 'New party'}>
          <form onSubmit={submit} style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 'var(--s3)' }}>
            <div style={{ gridColumn: 'span 2' }}>
              <Field label="Name" required value={form.name}
                     onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <div className="field">
                <label className="field__label">Role</label>
                <select
                  className="input"
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value as 'customer' | 'supplier' | 'both' })}
                >
                  <option value="customer">customer</option>
                  <option value="supplier">supplier</option>
                  <option value="both">both</option>
                </select>
              </div>
            </div>
            <Field label="Phone" value={form.phone ?? ''}
                   onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <Field label="GSTIN" value={form.gstin ?? ''}
                   onChange={(e) => setForm({ ...form, gstin: e.target.value })} />
            <Field label="State" value={form.stateCode}
                   onChange={(e) => setForm({ ...form, stateCode: e.target.value })} />

            <div style={{ gridColumn: 'span 6' }}>
              <Field label="Address" value={form.address}
                     onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>

            <div style={{ gridColumn: 'span 3' }}>
              <Field
                label="Opening cash (₹)"
                numeric
                type="number" step="0.01"
                value={form.openingCash / 100}
                onChange={(e) => setForm({ ...form, openingCash: rupeesToPaise(Number(e.target.value) || 0) })}
              />
            </div>
            <div style={{ gridColumn: 'span 3' }}>
              <Field
                label="Opening metal (g)"
                numeric
                type="number" step="0.001"
                value={form.openingMetalMg / 1000}
                onChange={(e) => setForm({ ...form, openingMetalMg: gramsToMg(Number(e.target.value) || 0) })}
              />
            </div>

            <div style={{ gridColumn: 'span 6', display: 'flex', gap: 'var(--s2)', alignItems: 'center' }}>
              <Button variant="primary" type="submit" disabled={save.loading}>
                {save.loading ? (editingId ? 'Updating…' : 'Adding…') : (editingId ? 'Update' : 'Add party')}
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

        {del.error  && <InlineAlert message={del.error}  onDismiss={del.clearError} />}
        {list.error && <InlineAlert message={list.error} onDismiss={() => list.reload()} />}

        <Sheet title="Parties" flush>
          {list.loading ? <div style={{ padding: 12 }}><Progress /></div>
            : (list.data?.length ?? 0) === 0 ? <Empty mark="shop" title="No customers on the ledger yet" />
            : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th style={{ width: 100 }}>Role</th>
                    <th style={{ width: 120 }}>Phone</th>
                    <th style={{ width: 170 }}>GSTIN</th>
                    <th className="num" style={{ width: 140 }}>Opening ₹</th>
                    <th className="num" style={{ width: 120 }}>Opening g</th>
                    <th style={{ width: 120 }} />
                  </tr>
                </thead>
                <tbody>
                  {(list.data ?? []).map((p) => (
                    <tr key={p.id}>
                      <td>{p.name}</td>
                      <td><Pill tone={p.role === 'customer' ? 'default' : 'accent'}>{p.role}</Pill></td>
                      <td style={{ fontSize: 'var(--t-sm)', color: 'var(--text-mute)' }}>{p.phone ?? ''}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-sm)', color: 'var(--text-mute)' }}>{p.gstin ?? ''}</td>
                      <td className="num"><Rupee paise={p.openingCash} /></td>
                      <td className="num">{p.openingMetalMg ? <Weight mg={p.openingMetalMg} /> : <span style={{ color: 'var(--text-faint)' }}>—</span>}</td>
                      <td className="num">
                        <div style={{ display: 'inline-flex', gap: 'var(--s2)' }}>
                          <Button variant="link" onClick={() => edit(p)}>edit</Button>
                          <Button variant="link" onClick={() => onDel(p)} disabled={del.loading} style={{ color: 'var(--neg)' }}>
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
