/* Sale screen — ported to the v2 design system (see design-system.md).
 *
 * The useSaleDraft hook is unchanged; only presentation moved. Keyboard flow
 * is preserved: type party, Enter picks first hit, cursor jumps to item,
 * Enter adds, F9 posts + prints.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { CH, invoke } from '@/lib/ipc';
import { useMutation, errText } from '@/lib/useAsync';
import type { Item, Party, SearchHit, SalePosted, MetalRate } from '@shared/ipc';
import { useSaleDraft, type RateMap } from './useSaleDraft';
import { useAnimatedNumber } from '@/lib/useAnimatedNumber';
import { Weighing } from '@/components/Weighing';
import { bell as playBell } from '@/lib/sound';
import {
  Sheet, Row, Button, Field, Rupee, Weight, Pill, Progress, Empty, toast,
} from '@/components/ui';

export function SaleScreen() {
  const [companyStateCode, setCompanyStateCode] = useState('');
  const [items, setItems] = useState<Item[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [rates, setRates] = useState<RateMap>({});
  const [partyQ, setPartyQ] = useState('');
  const [partyHits, setPartyHits] = useState<Party[]>([]);
  const [itemQ, setItemQ] = useState('');
  const [itemHits, setItemHits] = useState<Item[]>([]);
  const [bootLoading, setBootLoading] = useState(true);
  const [bootErr, setBootErr] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const [lastPosted, setLastPosted] = useState<SalePosted | null>(null);
  // Reserved emphasize moment on the TOTAL row — fires once per successful post.
  const [emphasizePost, setEmphasizePost] = useState(false);
  // Short accent wash whenever the running total actually ticks. Distinct
  // animation from the reserved post-success emphasize moment. The ref starts
  // at `-1` so the first legitimate change seeds `prev` without firing a
  // cosmetic flash on initial mount.
  const prevTotalRef = useRef<number>(-1);
  const [totalTickKey, setTotalTickKey] = useState(0);
  // The Weighing — signature identity animation. Shown ~1.4s on sale-post success.
  const [weighingBill, setWeighingBill] = useState<string | null>(null);

  const postMut = useMutation<any, SalePosted>((p) => invoke(CH.salePost, p));
  const printMut = useMutation<{ id: number }, unknown>((p) => invoke(CH.salePrint, p));

  const partyInputRef = useRef<HTMLInputElement>(null);
  const itemInputRef = useRef<HTMLInputElement>(null);

  const {
    draft, setDraft, addLine, updLine, delLine, reset, totals, interstate, toPayload,
  } = useSaleDraft(companyStateCode, rates);

  // Bump a key whenever `totals.total` changes value — React re-mounts the
  // flash wrapper, replaying the `.num-tick` keyframe exactly once per edit.
  // Skip the very first change (prev === -1) so the mount flash is suppressed.
  useMemo(() => {
    if (prevTotalRef.current === -1) {
      prevTotalRef.current = totals.total;
      return;
    }
    if (prevTotalRef.current !== totals.total) {
      prevTotalRef.current = totals.total;
      setTotalTickKey((k) => k + 1);
    }
  }, [totals.total]);

  // Smoothly roll the TOTAL from its previous value to the new one.
  const liveTotal = useAnimatedNumber(totals.total, 420);

  useEffect(() => {
    (async () => {
      try {
        const [co, its, ps, rs] = await Promise.all([
          invoke<any>(CH.companyGet),
          invoke<Item[]>(CH.itemsList),
          invoke<Party[]>(CH.partiesList),
          invoke<MetalRate[]>(CH.ratesList),
        ]);
        if (co?.state_code) setCompanyStateCode(co.state_code);
        setItems(its); setParties(ps);
        const rateMap: RateMap = {};
        for (const r of rs) rateMap[`${r.category}|${r.stamp}`] = r.ratePaisePerG / 100;
        setRates(rateMap);
        setTimeout(() => partyInputRef.current?.focus(), 50);
      } catch (e) {
        setBootErr(errText(e));
      } finally {
        setBootLoading(false);
      }
    })();
  }, []);

  // debounced party search
  useEffect(() => {
    if (!partyQ.trim() || draft.partyId) { setPartyHits([]); return; }
    const t = setTimeout(async () => {
      const hits = await invoke<SearchHit[]>(CH.search, { q: partyQ, scope: 'parties', limit: 8 });
      const ids = new Set(hits.filter((h) => h.kind === 'party').map((h) => h.id));
      setPartyHits(parties.filter((p) => ids.has(p.id)));
    }, 100);
    return () => clearTimeout(t);
  }, [partyQ, draft.partyId, parties]);

  // debounced item search
  useEffect(() => {
    if (!itemQ.trim()) { setItemHits([]); return; }
    const t = setTimeout(async () => {
      const hits = await invoke<SearchHit[]>(CH.search, { q: itemQ, scope: 'items', limit: 8 });
      const ids = new Set(hits.filter((h) => h.kind === 'item').map((h) => h.id));
      setItemHits(items.filter((i) => ids.has(i.id)));
    }, 100);
    return () => clearTimeout(t);
  }, [itemQ, items]);

  // F9 = post + print
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'F9') { e.preventDefault(); post(); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  function pickParty(p: Party) {
    setDraft((d) => ({ ...d, partyId: p.id, partyStateCode: p.stateCode }));
    setPartyQ(p.name); setPartyHits([]);
    setTimeout(() => itemInputRef.current?.focus(), 20);
  }
  function pickItem(it: Item) {
    addLine(it);
    setItemQ(''); setItemHits([]);
    itemInputRef.current?.focus();
  }

  async function post() {
    if (postMut.loading || printMut.loading) return;
    setErr('');
    let payload;
    try { payload = toPayload(); } catch (e: any) { setErr(e.message ?? String(e)); return; }
    try {
      const res = await postMut.run(payload);
      setLastPosted(res);
      setEmphasizePost(true);
      setTimeout(() => setEmphasizePost(false), 500);
      setWeighingBill(res.billNo);
      setTimeout(() => setWeighingBill(null), 1400);
      playBell();
      try { await printMut.run({ id: res.id }); } catch { /* print is best-effort */ }
      toast.success(`Bill ${res.billNo} posted`, {
        action: { label: 'print again', onClick: () => printMut.run({ id: res.id }) },
      });
      reset();
      setPartyQ(''); setItemQ('');
      partyInputRef.current?.focus();
    } catch { /* postMut.error surfaces below */ }
  }

  if (bootLoading) {
    return (
      <div className="ds-v2" style={{ padding: 16 }}>
        <Progress />
        <div style={{
          marginTop: 8, fontSize: 'var(--t-sm)',
          color: 'var(--text-mute)', textTransform: 'uppercase', letterSpacing: '0.08em',
        }}>opening the ledger…</div>
      </div>
    );
  }
  if (bootErr) {
    return (
      <div className="ds-v2" style={{ padding: 16 }}>
        <InlineAlert message={bootErr} onDismiss={() => window.location.reload()} />
      </div>
    );
  }

  const canPost = !!draft.partyId && draft.lines.length > 0 && !postMut.loading && !printMut.loading;

  return (
    <div
      className="ds-v2"
      style={{
        padding: 'var(--container-pad)',
        height: '100%',
        boxSizing: 'border-box',
      }}
    >
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 340px',
        gap: 'var(--s4)',
        height: '100%',
        minHeight: 0,
      }}>
        {/* ---------- MAIN COLUMN ---------- */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s3)', minWidth: 0 }}>

          {/* Party picker */}
          <div style={{ display: 'flex', gap: 'var(--s3)', alignItems: 'flex-end' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <Field
                label={
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    Buyer
                    {draft.partyId
                      ? <Pill tone="pos">selected</Pill>
                      : <span style={{ textTransform: 'none', letterSpacing: 0, color: 'var(--text-faint)' }}>
                          — type a name, then ↵
                        </span>}
                  </span>
                }
                inputRef={partyInputRef}
                value={partyQ}
                onChange={(e) => {
                  setPartyQ(e.target.value);
                  setDraft((d) => ({ ...d, partyId: null, partyStateCode: '' }));
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && partyHits[0]) { e.preventDefault(); pickParty(partyHits[0]); }
                }}
                placeholder="customer name"
              />
              {partyHits.length > 0 && (
                <div className="menu">
                  {partyHits.map((p, i) => (
                    <button
                      key={p.id}
                      className="menu__item"
                      data-focused={i === 0 ? 'true' : undefined}
                      onClick={() => pickParty(p)}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                        <span>{p.name}</span>
                        <span style={{
                          fontSize: 'var(--t-xs)', color: 'var(--text-mute)',
                          textTransform: 'uppercase', letterSpacing: '0.08em',
                        }}>{p.role}</span>
                      </div>
                      <div className="menu__item__meta">
                        {p.phone ?? '—'} · {p.stateCode || 'no state'}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div style={{ paddingBottom: 4 }}>
              {draft.partyId && (
                <Pill tone={interstate ? 'accent' : 'default'}>
                  {interstate ? 'IGST · interstate' : 'CGST + SGST'}
                </Pill>
              )}
            </div>
          </div>

          {/* Item picker */}
          <div style={{ position: 'relative' }}>
            <Field
              label="Add item"
              inputRef={itemInputRef}
              value={itemQ}
              onChange={(e) => setItemQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && itemHits[0]) { e.preventDefault(); pickItem(itemHits[0]); }
              }}
              placeholder="scan SKU or search item"
            />
            {itemHits.length > 0 && (
              <div className="menu">
                {itemHits.map((it, i) => (
                  <button
                    key={it.id}
                    className="menu__item"
                    data-focused={i === 0 ? 'true' : undefined}
                    onClick={() => pickItem(it)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                      <span>{it.name}</span>
                      <span style={{
                        fontFamily: 'var(--font-mono)',
                        color: 'var(--text-mute)',
                        fontSize: 'var(--t-sm)',
                      }}>{it.sku}</span>
                    </div>
                    <div className="menu__item__meta">
                      {it.category}{it.stamp ? ` · ${it.stamp}` : ''} · {it.unit}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Lines table */}
          <Sheet flush style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
            {draft.lines.length === 0 ? (
              <Empty mark="case" title="No lines yet">
                Pick an item above — scan a SKU or search — and press ↵ to begin the bill.
              </Empty>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th className="num" style={{ width: 60 }}>Qty</th>
                    <th className="num" style={{ width: 92 }}>Weight</th>
                    <th className="num" style={{ width: 108 }}>Rate</th>
                    <th className="num" style={{ width: 128 }}>Making</th>
                    <th className="num" style={{ width: 128 }}>Wastage</th>
                    <th className="num" style={{ width: 120 }}>Taxable</th>
                    <th className="num" style={{ width: 100 }}>Tax</th>
                    <th className="num" style={{ width: 120 }}>Total</th>
                    <th style={{ width: 28 }} />
                  </tr>
                </thead>
                <tbody>
                  {draft.lines.map((l, i) => {
                    const t = totals.perLine[i];
                    return (
                      <tr key={l.key} className="row-enter">
                        <td>
                          <div>{l.description}</div>
                          <div style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: 'var(--t-xs)',
                            color: 'var(--text-mute)',
                          }}>
                            {l.category}{l.stamp ? ` · ${l.stamp}` : ''} · {l.unit}
                          </div>
                        </td>
                        <td className="num">
                          <input
                            className="input input--num"
                            style={{ width: 48, height: 24 }}
                            type="number" step="1"
                            value={l.qty}
                            onChange={(e) => updLine(l.key, { qty: Number(e.target.value) || 0 })}
                          />
                        </td>
                        <td className="num">
                          {l.unit === 'pcs'
                            ? <span style={{ color: 'var(--text-faint)' }}>—</span>
                            : <input
                                className="input input--num"
                                style={{ width: 76, height: 24 }}
                                type="number" step="0.001"
                                value={l.weight}
                                onChange={(e) => updLine(l.key, { weight: Number(e.target.value) || 0 })}
                              />}
                        </td>
                        <td className="num">
                          <input
                            className="input input--num"
                            style={{ width: 92, height: 24 }}
                            type="number" step="0.01"
                            value={l.ratePerUnit}
                            onChange={(e) => updLine(l.key, { ratePerUnit: Number(e.target.value) || 0 })}
                          />
                        </td>
                        <td className="num">
                          <ChargeCell
                            value={l.makingValue}
                            mode={l.makingMode}
                            onChange={(patch) => updLine(l.key, {
                              makingValue: patch.value ?? l.makingValue,
                              makingMode: patch.mode ?? l.makingMode,
                            })}
                          />
                        </td>
                        <td className="num">
                          <ChargeCell
                            value={l.wastageValue}
                            mode={l.wastageMode}
                            onChange={(patch) => updLine(l.key, {
                              wastageValue: patch.value ?? l.wastageValue,
                              wastageMode: patch.mode ?? l.wastageMode,
                            })}
                          />
                        </td>
                        <td className="num"><Rupee paise={t.taxable} /></td>
                        <td className="num"><Rupee paise={t.cgst + t.sgst + t.igst} /></td>
                        <td className="num"><Rupee paise={t.total} /></td>
                        <td className="num">
                          <button
                            onClick={() => delLine(l.key)}
                            aria-label="remove line"
                            style={{
                              background: 'none', border: 'none', cursor: 'pointer',
                              color: 'var(--text-faint)',
                              fontSize: 16, lineHeight: 1,
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--neg)')}
                            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-faint)')}
                          >×</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </Sheet>
        </div>

        {/* ---------- RIGHT RAIL ---------- */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s3)', minHeight: 0, position: 'relative' }}>
          {weighingBill && (
            <div key={weighingBill} className="weighing-stage">
              <Weighing size={72} />
              <div className="weighing-caption">bill {weighingBill} · weighed</div>
            </div>
          )}

          <Sheet title="Totals">
            <dl className="kv">
              <dt>Subtotal</dt>
              <dd><Rupee paise={totals.subtotal} /></dd>
              {totals.cgst > 0 && (<><dt>CGST</dt><dd><Rupee paise={totals.cgst} /></dd></>)}
              {totals.sgst > 0 && (<><dt>SGST</dt><dd><Rupee paise={totals.sgst} /></dd></>)}
              {totals.igst > 0 && (<><dt>IGST</dt><dd><Rupee paise={totals.igst} /></dd></>)}
              <dt>Discount <span style={{ color: 'var(--text-faint)' }}>₹</span></dt>
              <dd>
                <input
                  className="input input--num"
                  style={{ width: 100, height: 24 }}
                  type="number" step="0.01"
                  value={draft.discount}
                  onChange={(e) => setDraft((d) => ({ ...d, discount: Number(e.target.value) || 0 }))}
                />
              </dd>
              <dt>Round-off <span style={{ color: 'var(--text-faint)' }}>₹</span></dt>
              <dd>
                <input
                  className="input input--num"
                  style={{ width: 100, height: 24 }}
                  type="number" step="0.01"
                  value={draft.roundOff}
                  onChange={(e) => setDraft((d) => ({ ...d, roundOff: Number(e.target.value) || 0 }))}
                />
              </dd>
            </dl>
            <div className="keyline-gold" style={{ marginTop: 'var(--s3)' }}>
              <Row
                emphasize={emphasizePost}
                style={{
                  minHeight: 'auto', padding: '4px 0 4px 10px',
                  border: 'none', background: 'transparent',
                }}
              >
                <span className="kv__grand-label" style={{ flex: 1 }}>Total</span>
                <span
                  key={totalTickKey}
                  className={totalTickKey > 0 && !emphasizePost ? 'kv__grand-value num-tick' : 'kv__grand-value'}
                  style={{ padding: '0 4px' }}
                >
                  <Rupee paise={liveTotal} />
                </span>
              </Row>
            </div>
          </Sheet>

          <Sheet title="Payment">
            <dl className="kv">
              <dt>Cash</dt>
              <dd>
                <input
                  className="input input--num"
                  style={{ width: 100, height: 24 }}
                  type="number" step="0.01"
                  value={draft.cash}
                  onChange={(e) => setDraft((d) => ({ ...d, cash: Number(e.target.value) || 0 }))}
                />
              </dd>
              <dt>Bank</dt>
              <dd>
                <input
                  className="input input--num"
                  style={{ width: 100, height: 24 }}
                  type="number" step="0.01"
                  value={draft.bank}
                  onChange={(e) => setDraft((d) => ({ ...d, bank: Number(e.target.value) || 0 }))}
                />
              </dd>
            </dl>
            <div style={{
              marginTop: 'var(--s3)',
              paddingTop: 'var(--s3)',
              borderTop: '1px solid var(--border)',
            }}>
              <div style={{
                fontSize: 'var(--t-sm)', color: 'var(--text-mute)',
                textTransform: 'uppercase', letterSpacing: '0.04em',
                marginBottom: 'var(--s2)',
              }}>
                Old gold
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
                <select
                  className="input"
                  style={{ height: 24, fontSize: 'var(--t-sm)' }}
                  value={draft.oldGold?.category ?? 'gold'}
                  onChange={(e) => setDraft((d) => ({
                    ...d,
                    oldGold: {
                      category: e.target.value as 'gold' | 'silver',
                      stamp: d.oldGold?.stamp ?? '22k',
                      weight: d.oldGold?.weight ?? 0,
                      rate: d.oldGold?.rate ?? 0,
                    },
                  }))}
                >
                  <option value="gold">gold</option>
                  <option value="silver">silver</option>
                </select>
                <input
                  className="input"
                  style={{ height: 24, fontFamily: 'var(--font-mono)' }}
                  placeholder="stamp"
                  value={draft.oldGold?.stamp ?? ''}
                  onChange={(e) => setDraft((d) => ({
                    ...d,
                    oldGold: {
                      ...(d.oldGold ?? { category: 'gold', weight: 0, rate: 0 }),
                      stamp: e.target.value,
                    },
                  }))}
                />
                <input
                  className="input input--num"
                  style={{ height: 24 }}
                  placeholder="g"
                  type="number" step="0.001"
                  value={draft.oldGold?.weight ?? 0}
                  onChange={(e) => setDraft((d) => ({
                    ...d,
                    oldGold: {
                      ...(d.oldGold ?? { category: 'gold', stamp: '22k', rate: 0 }),
                      weight: Number(e.target.value) || 0,
                    },
                  }))}
                />
                <input
                  className="input input--num"
                  style={{ height: 24 }}
                  placeholder="₹/g"
                  type="number" step="0.01"
                  value={draft.oldGold?.rate ?? 0}
                  onChange={(e) => setDraft((d) => ({
                    ...d,
                    oldGold: {
                      ...(d.oldGold ?? { category: 'gold', stamp: '22k', weight: 0 }),
                      rate: Number(e.target.value) || 0,
                    },
                  }))}
                />
              </div>
            </div>
            <div className="keyline-gold" style={{ marginTop: 'var(--s3)' }}>
              <dl className="kv">
                <dt>Paid</dt>
                <dd><Rupee paise={totals.paid} /></dd>
                <dt className="kv__grand-label">Balance</dt>
                <dd className={`kv__grand-value ${totals.balance > 0 ? 'kv__neg' : totals.balance < 0 ? 'kv__pos' : ''}`}>
                  <Rupee paise={totals.balance} />
                </dd>
              </dl>
            </div>
          </Sheet>

          <Button
            variant="primary"
            kbd="F9"
            onClick={post}
            disabled={!canPost}
            style={{ height: 40, fontSize: 'var(--t-md)' }}
          >
            {postMut.loading ? 'Weighing…'
              : printMut.loading ? 'Printing…'
              : 'Weigh & print'}
          </Button>

          {err && <InlineAlert message={err} onDismiss={() => setErr('')} />}
          {postMut.error && <InlineAlert message={postMut.error} onDismiss={postMut.clearError} />}

          {lastPosted && !err && !postMut.error && (
            <div style={{
              fontSize: 'var(--t-sm)', color: 'var(--text-mute)',
              display: 'inline-flex', alignItems: 'center', gap: 8,
            }}>
              <Pill tone="pos">weighed</Pill>
              <span style={{ fontFamily: 'var(--font-mono)' }}>
                bill {lastPosted.billNo} · <Rupee paise={lastPosted.totalPaise} />
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ChargeCell({
  value, mode, onChange,
}: {
  value: number;
  mode: 'pct' | 'per_gram' | 'per_pcs';
  onChange: (patch: { value?: number; mode?: 'pct' | 'per_gram' | 'per_pcs' }) => void;
}) {
  return (
    <div style={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
      <input
        className="input input--num"
        style={{ width: 60, height: 24 }}
        type="number" step="0.01"
        value={value}
        onChange={(e) => onChange({ value: Number(e.target.value) || 0 })}
      />
      <select
        className="input"
        style={{ height: 24, fontSize: 'var(--t-sm)', padding: '0 4px' }}
        value={mode}
        onChange={(e) => onChange({ mode: e.target.value as 'pct' | 'per_gram' | 'per_pcs' })}
      >
        <option value="pct">%</option>
        <option value="per_gram">/g</option>
        <option value="per_pcs">/pc</option>
      </select>
    </div>
  );
}

function InlineAlert({ message, onDismiss }: { message: string; onDismiss?: () => void }) {
  return (
    <div className="alert">
      <span style={{ whiteSpace: 'pre-wrap' }}>{message}</span>
      {onDismiss && (
        <button className="alert__dismiss" onClick={onDismiss} aria-label="dismiss">×</button>
      )}
    </div>
  );
}

/* Keep the `Weight` import live even if unused inline — some column cells use
 * it in the printed register (see electron/print.ts). */
void Weight;
