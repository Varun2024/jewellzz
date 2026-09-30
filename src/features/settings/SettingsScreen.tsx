import { useState } from 'react';
import { CH, invoke } from '@/lib/ipc';
import { useAsync, useMutation } from '@/lib/useAsync';
import { fmtPaise, rupeesToPaise } from '@/lib/format';
import { ErrorBanner, LoadingBlock, EmptyState, Spinner } from '@/components/Status';
import { CategoryBadge } from '@/components/CategoryBadge';
import { Buildings, Coins, Plus, Trash, Users } from '@phosphor-icons/react';
import type { MetalRate } from '@shared/ipc';

export function SettingsScreen() {
  return (
    <div className="max-w-4xl space-y-8">
      <CompanyCard />
      <RatesCard />
      <UsersCard />
    </div>
  );
}

// ─── Company ──────────────────────────────────────────────────────────
function CompanyCard() {
  const c = useAsync<any>(() => invoke(CH.companyGet));
  const [form, setForm] = useState<any>(null);
  const save = useMutation<any, any>((p) => invoke(CH.companyUpdate, p));

  // hydrate on first load
  if (form === null && c.data) {
    setForm({
      name: c.data.name ?? '',
      gstin: c.data.gstin ?? '',
      stateCode: c.data.state_code ?? '',
      address: c.data.address ?? '',
      phone: c.data.phone ?? '',
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await save.run(form);
      await c.reload();
    } catch { /* surfaced */ }
  }

  if (c.loading || !form) return (
    <div className="card"><LoadingBlock label="loading company…" /></div>
  );

  return (
    <div className="card space-y-4">
      <header className="flex items-center gap-3 pb-3 border-b border-[var(--rule)]">
        <Buildings size={22} weight="regular" color="var(--gold-700)" />
        <div>
          <div className="text-[15px] font-medium">Company details</div>
          <div className="text-[11px] text-[var(--ink-500)] mono uppercase tracking-wider">
            appears on every invoice
          </div>
        </div>
      </header>

      <form onSubmit={submit} className="grid grid-cols-6 gap-3">
        <label className="text-xs text-[var(--ink-500)] flex flex-col gap-1 col-span-3">
          Name
          <input required className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </label>
        <label className="text-xs text-[var(--ink-500)] flex flex-col gap-1 col-span-2">
          GSTIN
          <input required className="input mono" placeholder="15 chars" value={form.gstin}
                 onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })} />
        </label>
        <label className="text-xs text-[var(--ink-500)] flex flex-col gap-1">
          State code
          <input required className="input mono" placeholder="27" value={form.stateCode}
                 onChange={(e) => setForm({ ...form, stateCode: e.target.value })} />
        </label>

        <label className="text-xs text-[var(--ink-500)] flex flex-col gap-1 col-span-4">
          Address
          <input className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        </label>
        <label className="text-xs text-[var(--ink-500)] flex flex-col gap-1 col-span-2">
          Phone
          <input className="input mono" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </label>

        <div className="col-span-6 flex items-center gap-3">
          <button type="submit" className="btn-primary" disabled={save.loading}>
            {save.loading ? <Spinner label="saving" /> : 'Save company'}
          </button>
          {save.error && <ErrorBanner message={save.error} onDismiss={save.clearError} />}
        </div>
      </form>
    </div>
  );
}

// ─── Metal rates ──────────────────────────────────────────────────────
type RateForm = { category: 'gold' | 'silver'; stamp: string; ratePerG: number };
const EMPTY_RATE: RateForm = { category: 'gold', stamp: '', ratePerG: 0 };

function RatesCard() {
  const list = useAsync<MetalRate[]>(() => invoke(CH.ratesList));
  const [form, setForm] = useState<RateForm>(EMPTY_RATE);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Record<number, number>>({}); // id -> rate ₹/g being edited
  const upsert = useMutation<any, MetalRate>((p) => invoke(CH.ratesUpsert, p));
  const del = useMutation<number, { ok: boolean }>((id) => invoke(CH.ratesDelete, { id }));

  async function addNew(e: React.FormEvent) {
    e.preventDefault();
    if (!form.stamp || form.ratePerG <= 0) return;
    try {
      await upsert.run({
        category: form.category,
        stamp: form.stamp.trim(),
        ratePaisePerG: rupeesToPaise(form.ratePerG),
      });
      setForm(EMPTY_RATE);
      setShowAdd(false);
      await list.reload();
    } catch { /* surfaced */ }
  }

  async function saveEdit(r: MetalRate) {
    const val = editing[r.id];
    if (val === undefined || val <= 0) return;
    try {
      await upsert.run({ category: r.category, stamp: r.stamp, ratePaisePerG: rupeesToPaise(val) });
      const next = { ...editing };
      delete next[r.id];
      setEditing(next);
      await list.reload();
    } catch { /* surfaced */ }
  }

  async function onDelete(r: MetalRate) {
    if (!confirm(`Delete rate for ${r.category} ${r.stamp}?`)) return;
    try {
      await del.run(r.id);
      await list.reload();
    } catch { /* surfaced */ }
  }

  return (
    <div className="card space-y-4">
      <header className="flex items-center justify-between pb-3 border-b border-[var(--rule)]">
        <div className="flex items-center gap-3">
          <Coins size={22} weight="regular" color="var(--gold-700)" />
          <div>
            <div className="text-[15px] font-medium">Today's metal rates</div>
            <div className="text-[11px] text-[var(--ink-500)] mono uppercase tracking-wider">
              auto-fills sale + purchase lines
            </div>
          </div>
        </div>
        {!showAdd && (
          <button className="btn" onClick={() => setShowAdd(true)}>
            <Plus size={12} weight="bold" /> Add rate
          </button>
        )}
      </header>

      {showAdd && (
        <form onSubmit={addNew} className="grid grid-cols-6 gap-3 p-3 rounded" style={{ background: 'var(--paper-3)' }}>
          <label className="text-xs text-[var(--ink-500)] flex flex-col gap-1 col-span-2">
            Category
            <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as any })}>
              <option value="gold">gold</option>
              <option value="silver">silver</option>
            </select>
          </label>
          <label className="text-xs text-[var(--ink-500)] flex flex-col gap-1 col-span-2">
            Stamp
            <input className="input mono" placeholder="22k / 925" value={form.stamp}
                   onChange={(e) => setForm({ ...form, stamp: e.target.value })} />
          </label>
          <label className="text-xs text-[var(--ink-500)] flex flex-col gap-1 col-span-2">
            Rate (₹ per gram)
            <input type="number" step="0.01" className="input mono" value={form.ratePerG}
                   onChange={(e) => setForm({ ...form, ratePerG: Number(e.target.value) || 0 })} />
          </label>
          <div className="col-span-6 flex items-center gap-2">
            <button type="submit" className="btn-primary" disabled={upsert.loading}>
              {upsert.loading ? <Spinner label="saving" /> : 'Add'}
            </button>
            <button type="button" className="btn" onClick={() => { setShowAdd(false); setForm(EMPTY_RATE); }}>Cancel</button>
          </div>
        </form>
      )}

      {upsert.error && <ErrorBanner message={upsert.error} onDismiss={upsert.clearError} />}
      {del.error && <ErrorBanner message={del.error} onDismiss={del.clearError} />}

      {list.loading ? <LoadingBlock label="loading rates…" /> : (
        <table className="ledger-table">
          <thead>
            <tr>
              <th>Category</th>
              <th className="text-right">Rate (₹ / gram)</th>
              <th className="text-right">Last updated</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {(list.data ?? []).map((r) => {
              const isEditing = editing[r.id] !== undefined;
              return (
                <tr key={r.id}>
                  <td><CategoryBadge category={r.category} stamp={r.stamp} size="md" /></td>
                  <td className="num">
                    {isEditing ? (
                      <div className="flex items-center justify-end gap-1">
                        <input
                          type="number" step="0.01" autoFocus
                          className="input mono text-right"
                          style={{ width: 110 }}
                          value={editing[r.id]}
                          onChange={(e) => setEditing({ ...editing, [r.id]: Number(e.target.value) || 0 })}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') { e.preventDefault(); saveEdit(r); }
                            if (e.key === 'Escape') { const n = { ...editing }; delete n[r.id]; setEditing(n); }
                          }}
                        />
                        <button className="btn-primary" style={{ height: 26, padding: '0 8px' }} onClick={() => saveEdit(r)}>
                          save
                        </button>
                      </div>
                    ) : (
                      <button
                        className="mono hover:text-[var(--gold-700)] transition-colors"
                        style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', color: 'inherit', fontSize: 15 }}
                        onClick={() => setEditing({ ...editing, [r.id]: r.ratePaisePerG / 100 })}
                        title="click to edit"
                      >
                        {fmtPaise(r.ratePaisePerG)}
                      </button>
                    )}
                  </td>
                  <td className="num text-[var(--ink-500)]" style={{ fontSize: 11 }}>
                    {formatWhen(r.updatedAt)}
                  </td>
                  <td className="text-right">
                    <button
                      className="btn-ghost"
                      style={{ padding: 4, height: 24 }}
                      onClick={() => onDelete(r)}
                      disabled={del.loading}
                      aria-label="delete"
                    >
                      <Trash size={12} color="var(--rose-500)" />
                    </button>
                  </td>
                </tr>
              );
            })}
            {(list.data?.length ?? 0) === 0 && (
              <tr><td colSpan={4}><EmptyState hint="Add gold + silver rates so sale lines auto-fill">no rates set</EmptyState></td></tr>
            )}
          </tbody>
        </table>
      )}

      <p className="text-[11px] text-[var(--ink-500)]">
        Click any rate to edit inline · Enter saves · Esc cancels · rates auto-fill every sale + purchase line when the item's (category, stamp) matches
      </p>
    </div>
  );
}

function formatWhen(ts: number): string {
  const d = new Date(ts * 1000);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

// ─── Users ────────────────────────────────────────────────────────────
type UserRow = { id: number; name: string; role: 'owner' | 'counter'; active: 0 | 1; createdAt: number };

function UsersCard() {
  const list = useAsync<UserRow[]>(() => invoke('users.list' as any));
  const [addForm, setAddForm] = useState<{ name: string; role: 'owner' | 'counter'; pin: string } | null>(null);
  const [pinForId, setPinForId] = useState<number | null>(null);
  const [newPin, setNewPin] = useState('');

  const create = useMutation<any, any>((p) => invoke(CH.usersCreate, p));
  const setPin = useMutation<any, any>((p) => invoke(CH.usersSetPin, p));
  const deact = useMutation<number, any>((id) => invoke(CH.usersDeactivate, { id }));

  async function add() {
    if (!addForm) return;
    try {
      await create.run(addForm);
      setAddForm(null);
      await list.reload();
    } catch { /* surfaced */ }
  }
  async function changePin(id: number) {
    if (newPin.length < 4) return;
    try {
      await setPin.run({ id, pin: newPin });
      setPinForId(null); setNewPin('');
    } catch { /* surfaced */ }
  }
  async function onDeactivate(u: UserRow) {
    if (!confirm(`Deactivate ${u.name}? They will not be able to sign in.`)) return;
    try { await deact.run(u.id); await list.reload(); } catch { /* surfaced */ }
  }

  return (
    <div className="card space-y-4">
      <header className="flex items-center justify-between pb-3 border-b border-[var(--rule)]">
        <div className="flex items-center gap-3">
          <Users size={22} weight="regular" color="var(--gold-700)" />
          <div>
            <div className="text-[15px] font-medium">Users &amp; PINs</div>
            <div className="text-[11px] text-[var(--ink-500)] mono uppercase tracking-wider">
              owner sees ledgers, exports, settings · counter can sell + purchase
            </div>
          </div>
        </div>
        {!addForm && (
          <button className="btn" onClick={() => setAddForm({ name: '', role: 'counter', pin: '' })}>
            <Plus size={12} weight="bold" /> Add user
          </button>
        )}
      </header>

      {addForm && (
        <form onSubmit={(e) => { e.preventDefault(); add(); }} className="grid grid-cols-6 gap-3 p-3 rounded" style={{ background: 'var(--paper-3)' }}>
          <label className="text-xs text-[var(--ink-500)] flex flex-col gap-1 col-span-2">
            Name
            <input required className="input" value={addForm.name} onChange={(e) => setAddForm({ ...addForm, name: e.target.value })} />
          </label>
          <label className="text-xs text-[var(--ink-500)] flex flex-col gap-1 col-span-2">
            Role
            <select className="input" value={addForm.role} onChange={(e) => setAddForm({ ...addForm, role: e.target.value as 'owner' | 'counter' })}>
              <option value="counter">counter</option>
              <option value="owner">owner</option>
            </select>
          </label>
          <label className="text-xs text-[var(--ink-500)] flex flex-col gap-1 col-span-2">
            PIN (4–8 digits)
            <input required inputMode="numeric" className="input mono" pattern="\d{4,8}" placeholder="1234"
                   value={addForm.pin}
                   onChange={(e) => setAddForm({ ...addForm, pin: e.target.value.replace(/\D/g, '').slice(0, 8) })} />
          </label>
          <div className="col-span-6 flex items-center gap-2">
            <button type="submit" className="btn-primary" disabled={create.loading}>
              {create.loading ? <Spinner label="saving" /> : 'Add'}
            </button>
            <button type="button" className="btn" onClick={() => setAddForm(null)}>Cancel</button>
            {create.error && <ErrorBanner message={create.error} onDismiss={create.clearError} />}
          </div>
        </form>
      )}

      {setPin.error && <ErrorBanner message={setPin.error} onDismiss={setPin.clearError} />}
      {deact.error && <ErrorBanner message={deact.error} onDismiss={deact.clearError} />}

      {list.loading ? <LoadingBlock label="loading users…" /> : (
        <table className="ledger-table">
          <thead><tr>
            <th>Name</th><th>Role</th><th>Status</th><th></th>
          </tr></thead>
          <tbody>
            {(list.data ?? []).map((u) => (
              <tr key={u.id}>
                <td style={{ fontWeight: 500 }}>{u.name}</td>
                <td className="mono text-[11px] uppercase tracking-wider" style={{ color: u.role === 'owner' ? 'var(--gold-700)' : 'var(--ink-500)' }}>
                  {u.role}
                </td>
                <td className="mono text-[11px] uppercase tracking-wider">
                  {u.active ? 'active' : <span className="text-[var(--ink-300)]">inactive</span>}
                </td>
                <td className="text-right">
                  {pinForId === u.id ? (
                    <div className="flex items-center gap-1 justify-end">
                      <input
                        autoFocus type="password" inputMode="numeric"
                        className="input mono" style={{ width: 110 }} value={newPin}
                        onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') { e.preventDefault(); changePin(u.id); }
                          if (e.key === 'Escape') { setPinForId(null); setNewPin(''); }
                        }}
                      />
                      <button className="btn-primary" style={{ height: 26, padding: '0 8px' }} onClick={() => changePin(u.id)}>save</button>
                    </div>
                  ) : (
                    u.active ? (
                      <div className="flex gap-2 justify-end">
                        <button className="link" onClick={() => { setPinForId(u.id); setNewPin(''); }}>change PIN</button>
                        <button className="link text-danger" onClick={() => onDeactivate(u)}>
                          <Trash size={10} weight="bold" style={{ display: 'inline', marginRight: 2 }} />
                          deactivate
                        </button>
                      </div>
                    ) : null
                  )}
                </td>
              </tr>
            ))}
            {(list.data?.length ?? 0) === 0 && (
              <tr><td colSpan={4}><EmptyState hint="At least one owner is required">no users</EmptyState></td></tr>
            )}
          </tbody>
        </table>
      )}
      <p className="text-[11px] text-[var(--ink-500)]">
        Owner-only actions: Settings edits, deletes, exports, backup, karigar payments, refining, label printing.
      </p>
    </div>
  );
}
