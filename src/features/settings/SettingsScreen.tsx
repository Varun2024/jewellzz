/* Settings — Company / Metal rates / Users. Ported to v2 primitives. */

import { useState } from 'react';
import { CH, invoke } from '@/lib/ipc';
import { useAsync, useMutation } from '@/lib/useAsync';
import { rupeesToPaise } from '@/lib/format';
import { CategoryBadge } from '@/components/CategoryBadge';
import { Buildings, Coins, Plus, Trash, Users, SpeakerHigh } from '@phosphor-icons/react';
import type { MetalRate } from '@shared/ipc';
import {
  Sheet, Button, Field, Rupee, Pill, Progress, Empty, toast,
} from '@/components/ui';
import { isSoundEnabled, setSoundEnabled, bell as previewBell } from '@/lib/sound';

export function SettingsScreen() {
  return (
    <div className="ds-v2 mood-book" style={{ padding: 'var(--container-pad)', height: '100%', overflow: 'auto', boxSizing: 'border-box' }}>
      <div style={{ maxWidth: 900, display: 'flex', flexDirection: 'column', gap: 'var(--s5)' }}>
        <CompanyCard />
        <RatesCard />
        <SoundCard />
        <UsersCard />
      </div>
    </div>
  );
}

/* ---------------------------- Company ---------------------------- */

function CompanyCard() {
  const c = useAsync<any>(() => invoke(CH.companyGet));
  const [form, setForm] = useState<any>(null);
  const save = useMutation<any, any>((p) => invoke(CH.companyUpdate, p));

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
      toast.success('Company details saved');
      await c.reload();
    } catch { /* surfaced */ }
  }

  if (c.loading || !form) {
    return (
      <Sheet title={<HeaderLabel icon={<Buildings size={18} color="var(--accent-press)" />} title="Company details" hint="appears on every invoice" />}>
        <Progress />
      </Sheet>
    );
  }

  return (
    <Sheet title={<HeaderLabel icon={<Buildings size={18} color="var(--accent-press)" />} title="Company details" hint="appears on every invoice" />}>
      <form onSubmit={submit} style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 'var(--s3)' }}>
        <div style={{ gridColumn: 'span 3' }}>
          <Field label="Name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div style={{ gridColumn: 'span 2' }}>
          <Field label="GSTIN" required placeholder="15 chars" value={form.gstin}
                 onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })} />
        </div>
        <div style={{ gridColumn: 'span 1' }}>
          <Field label="State code" required placeholder="27" value={form.stateCode}
                 onChange={(e) => setForm({ ...form, stateCode: e.target.value })} />
        </div>

        <div style={{ gridColumn: 'span 4' }}>
          <Field label="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        </div>
        <div style={{ gridColumn: 'span 2' }}>
          <Field label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </div>

        <div style={{ gridColumn: 'span 6', display: 'flex', alignItems: 'center', gap: 'var(--s3)' }}>
          <Button variant="primary" type="submit" disabled={save.loading}>
            {save.loading ? 'Saving…' : 'Save company'}
          </Button>
          {save.error && <InlineAlert message={save.error} onDismiss={save.clearError} />}
        </div>
      </form>
    </Sheet>
  );
}

/* ------------------------- Metal rates --------------------------- */

type RateForm = { category: 'gold' | 'silver'; stamp: string; ratePerG: number };
const EMPTY_RATE: RateForm = { category: 'gold', stamp: '', ratePerG: 0 };

function RatesCard() {
  const list = useAsync<MetalRate[]>(() => invoke(CH.ratesList));
  const [form, setForm] = useState<RateForm>(EMPTY_RATE);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Record<number, number>>({});
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
      toast.success(`Rate added · ${form.category} ${form.stamp}`);
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
      toast.success(`Rate updated · ${r.category} ${r.stamp}`);
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
      toast.success(`Rate removed · ${r.category} ${r.stamp}`);
      await list.reload();
    } catch { /* surfaced */ }
  }

  return (
    <Sheet
      title={<HeaderLabel icon={<Coins size={18} color="var(--accent-press)" />} title="Today's metal rates" hint="auto-fills sale + purchase lines" />}
      action={!showAdd && (
        <Button onClick={() => setShowAdd(true)} leading={<Plus size={12} weight="bold" />}>
          Add rate
        </Button>
      )}
    >
      {showAdd && (
        <form onSubmit={addNew} style={{
          display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 'var(--s3)',
          padding: 'var(--s3)', background: 'var(--surface-hi)', borderRadius: 'var(--radius-1)',
          marginBottom: 'var(--s3)',
        }}>
          <div style={{ gridColumn: 'span 2' }}>
            <div className="field">
              <label className="field__label">Category</label>
              <select
                className="input"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value as 'gold' | 'silver' })}
              >
                <option value="gold">gold</option>
                <option value="silver">silver</option>
              </select>
            </div>
          </div>
          <div style={{ gridColumn: 'span 2' }}>
            <Field label="Stamp" placeholder="22k / 925" value={form.stamp}
                   onChange={(e) => setForm({ ...form, stamp: e.target.value })} />
          </div>
          <div style={{ gridColumn: 'span 2' }}>
            <Field
              label="Rate (₹ / g)"
              numeric
              type="number" step="0.01"
              value={form.ratePerG}
              onChange={(e) => setForm({ ...form, ratePerG: Number(e.target.value) || 0 })}
            />
          </div>
          <div style={{ gridColumn: 'span 6', display: 'flex', gap: 'var(--s2)' }}>
            <Button variant="primary" type="submit" disabled={upsert.loading}>
              {upsert.loading ? 'Saving…' : 'Add'}
            </Button>
            <Button type="button" onClick={() => { setShowAdd(false); setForm(EMPTY_RATE); }}>Cancel</Button>
          </div>
        </form>
      )}

      {upsert.error && <InlineAlert message={upsert.error} onDismiss={upsert.clearError} />}
      {del.error    && <InlineAlert message={del.error}    onDismiss={del.clearError} />}

      {list.loading ? <Progress /> : (
        (list.data?.length ?? 0) === 0 ? (
          <Empty mark="morning" title="No rates yet — set today's morning rate" />
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Category</th>
                <th className="num">Rate (₹ / g)</th>
                <th className="num" style={{ width: 140 }}>Last updated</th>
                <th style={{ width: 40 }} />
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
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                          <input
                            autoFocus
                            className="input input--num"
                            style={{ width: 110, height: 24 }}
                            type="number" step="0.01"
                            value={editing[r.id]}
                            onChange={(e) => setEditing({ ...editing, [r.id]: Number(e.target.value) || 0 })}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter')  { e.preventDefault(); saveEdit(r); }
                              if (e.key === 'Escape') { const n = { ...editing }; delete n[r.id]; setEditing(n); }
                            }}
                          />
                          <button
                            className="btn btn--primary"
                            style={{ height: 24, padding: '0 8px' }}
                            onClick={() => saveEdit(r)}
                          >save</button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setEditing({ ...editing, [r.id]: r.ratePaisePerG / 100 })}
                          title="click to edit"
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            fontFamily: 'var(--font-mono)',
                            fontVariantNumeric: 'tabular-nums',
                            fontSize: 'var(--t-md)', color: 'var(--text)',
                          }}
                        >
                          <Rupee paise={r.ratePaisePerG} />
                        </button>
                      )}
                    </td>
                    <td className="num" style={{ fontSize: 'var(--t-xs)', color: 'var(--text-mute)' }}>
                      {formatWhen(r.updatedAt)}
                    </td>
                    <td className="num">
                      <button
                        onClick={() => onDelete(r)}
                        disabled={del.loading}
                        aria-label="delete"
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: 'var(--text-faint)', padding: 4,
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--neg)')}
                        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-faint)')}
                      >
                        <Trash size={12} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )
      )}

      <div style={{ marginTop: 'var(--s2)', fontSize: 'var(--t-xs)', color: 'var(--text-faint)' }}>
        Click any rate to edit inline · Enter saves · Esc cancels · rates auto-fill every sale + purchase line when the item's (category, stamp) matches.
      </div>
    </Sheet>
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

/* ------------------------------ Sound ---------------------------- */

function SoundCard() {
  const [on, setOn] = useState(isSoundEnabled);

  function toggle() {
    const next = !on;
    setSoundEnabled(next);
    setOn(next);
    // play a preview chime when turning on so the user hears what they chose
    if (next) {
      setTimeout(() => previewBell(), 60);
    }
    toast.success(next ? 'Sound on' : 'Sound off');
  }

  return (
    <Sheet
      title={
        <HeaderLabel
          icon={<SpeakerHigh size={18} color="var(--accent-press)" />}
          title="Sound"
          hint="opt-in cues on sale post, backup, item added"
        />
      }
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s4)' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 'var(--t-base)' }}>
            {on ? 'Sound is on' : 'Sound is off'}
          </div>
          <div style={{ fontSize: 'var(--t-xs)', color: 'var(--text-mute)', marginTop: 2 }}>
            Short, quiet cues for sale posted, ledger sealed, and toast feedback.
            Nothing plays unless this is on.
          </div>
        </div>
        <Button variant={on ? 'primary' : 'secondary'} onClick={toggle}>
          {on ? 'Turn off' : 'Turn on'}
        </Button>
      </div>
    </Sheet>
  );
}

/* ----------------------------- Users ---------------------------- */

type UserRow = { id: number; name: string; role: 'owner' | 'counter'; active: 0 | 1; createdAt: number };

function UsersCard() {
  const list = useAsync<UserRow[]>(() => invoke('users.list' as any));
  const [addForm, setAddForm] = useState<{ name: string; role: 'owner' | 'counter'; pin: string } | null>(null);
  const [pinForId, setPinForId] = useState<number | null>(null);
  const [newPin, setNewPin] = useState('');

  const create = useMutation<any, any>((p) => invoke(CH.usersCreate, p));
  const setPin = useMutation<any, any>((p) => invoke(CH.usersSetPin, p));
  const deact  = useMutation<number, any>((id) => invoke(CH.usersDeactivate, { id }));

  async function add() {
    if (!addForm) return;
    try {
      await create.run(addForm);
      toast.success(`Added ${addForm.name}`);
      setAddForm(null);
      await list.reload();
    } catch { /* surfaced */ }
  }
  async function changePin(id: number) {
    if (newPin.length < 4) return;
    try {
      await setPin.run({ id, pin: newPin });
      toast.success('PIN changed');
      setPinForId(null); setNewPin('');
    } catch { /* surfaced */ }
  }
  async function onDeactivate(u: UserRow) {
    if (!confirm(`Deactivate ${u.name}? They will not be able to sign in.`)) return;
    try {
      await deact.run(u.id);
      toast.success(`${u.name} deactivated`);
      await list.reload();
    } catch { /* surfaced */ }
  }

  return (
    <Sheet
      title={<HeaderLabel icon={<Users size={18} color="var(--accent-press)" />} title="Users & PINs" hint="owner sees ledgers, exports, settings · counter can sell + purchase" />}
      action={!addForm && (
        <Button onClick={() => setAddForm({ name: '', role: 'counter', pin: '' })} leading={<Plus size={12} weight="bold" />}>
          Add user
        </Button>
      )}
    >
      {addForm && (
        <form onSubmit={(e) => { e.preventDefault(); add(); }} style={{
          display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 'var(--s3)',
          padding: 'var(--s3)', background: 'var(--surface-hi)', borderRadius: 'var(--radius-1)',
          marginBottom: 'var(--s3)',
        }}>
          <div style={{ gridColumn: 'span 2' }}>
            <Field label="Name" required value={addForm.name}
                   onChange={(e) => setAddForm({ ...addForm, name: e.target.value })} />
          </div>
          <div style={{ gridColumn: 'span 2' }}>
            <div className="field">
              <label className="field__label">Role</label>
              <select
                className="input"
                value={addForm.role}
                onChange={(e) => setAddForm({ ...addForm, role: e.target.value as 'owner' | 'counter' })}
              >
                <option value="counter">counter</option>
                <option value="owner">owner</option>
              </select>
            </div>
          </div>
          <div style={{ gridColumn: 'span 2' }}>
            <Field
              label="PIN (4–8 digits)"
              required
              inputMode="numeric"
              pattern="\d{4,8}"
              placeholder="1234"
              value={addForm.pin}
              onChange={(e) => setAddForm({ ...addForm, pin: e.target.value.replace(/\D/g, '').slice(0, 8) })}
            />
          </div>
          <div style={{ gridColumn: 'span 6', display: 'flex', gap: 'var(--s2)', alignItems: 'center' }}>
            <Button variant="primary" type="submit" disabled={create.loading}>
              {create.loading ? 'Saving…' : 'Add'}
            </Button>
            <Button type="button" onClick={() => setAddForm(null)}>Cancel</Button>
            {create.error && <InlineAlert message={create.error} onDismiss={create.clearError} />}
          </div>
        </form>
      )}

      {setPin.error && <InlineAlert message={setPin.error} onDismiss={setPin.clearError} />}
      {deact.error  && <InlineAlert message={deact.error}  onDismiss={deact.clearError} />}

      {list.loading ? <Progress /> : (
        (list.data?.length ?? 0) === 0 ? (
          <Empty title="No users yet">At least one owner is required.</Empty>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th style={{ width: 100 }}>Role</th>
                <th style={{ width: 100 }}>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(list.data ?? []).map((u) => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 500 }}>{u.name}</td>
                  <td><Pill tone={u.role === 'owner' ? 'accent' : 'default'}>{u.role}</Pill></td>
                  <td>
                    {u.active
                      ? <Pill tone="pos">active</Pill>
                      : <span style={{ color: 'var(--text-faint)', fontSize: 'var(--t-sm)' }}>inactive</span>}
                  </td>
                  <td className="num">
                    {pinForId === u.id ? (
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                        <input
                          autoFocus type="password" inputMode="numeric"
                          className="input input--num" style={{ width: 110, height: 24 }}
                          value={newPin}
                          onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter')  { e.preventDefault(); changePin(u.id); }
                            if (e.key === 'Escape') { setPinForId(null); setNewPin(''); }
                          }}
                        />
                        <button
                          className="btn btn--primary"
                          style={{ height: 24, padding: '0 8px' }}
                          onClick={() => changePin(u.id)}
                        >save</button>
                      </div>
                    ) : u.active ? (
                      <div style={{ display: 'inline-flex', gap: 'var(--s2)', justifyContent: 'flex-end' }}>
                        <Button variant="link" onClick={() => { setPinForId(u.id); setNewPin(''); }}>
                          change PIN
                        </Button>
                        <Button
                          variant="link"
                          onClick={() => onDeactivate(u)}
                          style={{ color: 'var(--neg)' }}
                        >
                          deactivate
                        </Button>
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      )}

      <div style={{ marginTop: 'var(--s2)', fontSize: 'var(--t-xs)', color: 'var(--text-faint)' }}>
        Owner-only: Settings edits, deletes, exports, backup, karigar payments, refining, label printing.
      </div>
    </Sheet>
  );
}

/* ----------------------------- bits ----------------------------- */

function HeaderLabel({ icon, title, hint }: { icon: React.ReactNode; title: string; hint: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s2)' }}>
      {icon}
      <span>{title}</span>
      <span style={{
        fontSize: 'var(--t-xs)', color: 'var(--text-faint)',
        textTransform: 'uppercase', letterSpacing: '0.08em',
        fontWeight: 400,
      }}>
        · {hint}
      </span>
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
