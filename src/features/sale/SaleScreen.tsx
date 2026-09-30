import { useEffect, useRef, useState } from 'react';
import { CH, invoke } from '@/lib/ipc';
import { useMutation, errText } from '@/lib/useAsync';
import { fmtPaise } from '@/lib/format';
import { ErrorBanner, Spinner, LoadingBlock } from '@/components/Status';
import type { Item, Party, SearchHit, SalePosted, MetalRate } from '@shared/ipc';
import { useSaleDraft, type RateMap } from './useSaleDraft';

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
  const postMut = useMutation<any, SalePosted>((p) => invoke(CH.salePost, p));
  const printMut = useMutation<{ id: number }, unknown>((p) => invoke(CH.salePrint, p));

  const partyInputRef = useRef<HTMLInputElement>(null);
  const itemInputRef = useRef<HTMLInputElement>(null);

  const {
    draft, setDraft, addLine, updLine, delLine, reset, totals, interstate, toPayload,
  } = useSaleDraft(companyStateCode, rates);

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

  // debounce party search
  useEffect(() => {
    if (!partyQ.trim() || draft.partyId) { setPartyHits([]); return; }
    const t = setTimeout(async () => {
      const hits = await invoke<SearchHit[]>(CH.search, { q: partyQ, scope: 'parties', limit: 8 });
      const ids = new Set(hits.filter((h) => h.kind === 'party').map((h) => h.id));
      setPartyHits(parties.filter((p) => ids.has(p.id)));
    }, 100);
    return () => clearTimeout(t);
  }, [partyQ, draft.partyId, parties]);

  // debounce item search
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
      try { await printMut.run({ id: res.id }); } catch { /* print is best-effort */ }
      reset();
      setPartyQ(''); setItemQ('');
      partyInputRef.current?.focus();
    } catch { /* postMut.error surfaces below */ }
  }

  if (bootLoading) return <LoadingBlock label="loading sale screen…" />;
  if (bootErr) return <ErrorBanner message={bootErr} onDismiss={() => window.location.reload()} />;

  return (
    <div className="grid grid-cols-[1fr_320px] gap-4 h-full">
      <div className="space-y-3 min-w-0">
        {/* Party picker */}
        <div className="flex gap-3 items-end">
          <div className="relative flex-1">
            <label className="section-label block mb-1">
              — buyer ————————{draft.partyId ? <span className="text-[var(--moss-600)] not-italic ml-2">✓</span> : <span className="text-[var(--amber-500)] not-italic ml-2">select from list</span>}
            </label>
            <input
              ref={partyInputRef} className="input w-full"
              value={partyQ}
              onChange={(e) => { setPartyQ(e.target.value); setDraft((d) => ({ ...d, partyId: null, partyStateCode: '' })); }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && partyHits[0]) { e.preventDefault(); pickParty(partyHits[0]); }
              }}
              placeholder="type customer name, then Enter…"
            />
            {partyHits.length > 0 && (
              <div className="absolute z-10 bg-white border border-border rounded shadow w-full max-h-56 overflow-auto mt-1">
                {partyHits.map((p, i) => (
                  <button key={p.id} className={`w-full text-left px-3 py-1.5 text-sm hover:bg-[var(--bg-hover)] ${i === 0 ? 'bg-[var(--bg-hover)]/50' : ''}`} onClick={() => pickParty(p)}>
                    <div className="flex justify-between"><span>{p.name}</span><span className="text-xs text-muted">{p.role}</span></div>
                    <div className="text-xs text-muted mono">{p.phone ?? ''} · {p.stateCode || '—'}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="text-[11px] mono tracking-wider whitespace-nowrap uppercase pb-1">
            {interstate
              ? <span className="text-[var(--amber-500)]">IGST · interstate</span>
              : <span className="text-[var(--ink-500)]">CGST + SGST</span>}
          </div>
        </div>

        {/* Item picker */}
        <div className="relative">
          <label className="section-label block mb-1">— add item ————————</label>
          <input
            ref={itemInputRef} className="input w-full"
            value={itemQ}
            onChange={(e) => setItemQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && itemHits[0]) { e.preventDefault(); pickItem(itemHits[0]); }
            }}
            placeholder="scan SKU or search item, then Enter…"
          />
          {itemHits.length > 0 && (
            <div className="absolute z-10 bg-white border border-border rounded shadow w-full max-h-64 overflow-auto mt-1">
              {itemHits.map((it, i) => (
                <button key={it.id} className={`w-full text-left px-3 py-1.5 text-sm hover:bg-[var(--bg-hover)] ${i === 0 ? 'bg-[var(--bg-hover)]/50' : ''}`} onClick={() => pickItem(it)}>
                  <div className="flex justify-between">
                    <span>{it.name}</span>
                    <span className="text-xs text-muted mono">{it.sku}</span>
                  </div>
                  <div className="text-xs text-muted mono">{it.category}{it.stamp ? ` · ${it.stamp}` : ''} · {it.unit}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Lines */}
        <div className="overflow-x-auto">
          <table className="ledger-table" style={{ fontSize: 12 }}>
            <thead>
              <tr>
                <th>Item</th>
                <th className="text-right">Qty</th>
                <th className="text-right">Weight</th>
                <th className="text-right">Rate/unit</th>
                <th className="text-right">Making</th>
                <th className="text-right">Wastage</th>
                <th className="text-right">Taxable</th>
                <th className="text-right">Tax</th>
                <th className="text-right">Total</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {draft.lines.map((l, i) => {
                const t = totals.perLine[i];
                return (
                  <tr key={l.key} className="border-b border-border/50">
                    <td className="py-1 pr-2">
                      <div>{l.description}</div>
                      <div className="text-muted mono">{l.category}{l.stamp ? ` · ${l.stamp}` : ''} · {l.unit}</div>
                    </td>
                    <td className="text-right">
                      <input className="input w-14 text-right mono" type="number" step="1"
                             value={l.qty} onChange={(e) => updLine(l.key, { qty: Number(e.target.value) || 0 })} />
                    </td>
                    <td className="text-right">
                      {l.unit === 'pcs' ? <span className="text-muted">—</span> : (
                        <input className="input w-20 text-right mono" type="number" step="0.001"
                               value={l.weight} onChange={(e) => updLine(l.key, { weight: Number(e.target.value) || 0 })} />
                      )}
                    </td>
                    <td className="text-right">
                      <input className="input w-24 text-right mono" type="number" step="0.01"
                             value={l.ratePerUnit} onChange={(e) => updLine(l.key, { ratePerUnit: Number(e.target.value) || 0 })} />
                    </td>
                    <td className="text-right">
                      <div className="flex gap-1 justify-end">
                        <input className="input w-16 text-right mono" type="number" step="0.01"
                               value={l.makingValue} onChange={(e) => updLine(l.key, { makingValue: Number(e.target.value) || 0 })} />
                        <select className="input" value={l.makingMode} onChange={(e) => updLine(l.key, { makingMode: e.target.value as any })}>
                          <option value="pct">%</option><option value="per_gram">/g</option><option value="per_pcs">/pc</option>
                        </select>
                      </div>
                    </td>
                    <td className="text-right">
                      <div className="flex gap-1 justify-end">
                        <input className="input w-16 text-right mono" type="number" step="0.01"
                               value={l.wastageValue} onChange={(e) => updLine(l.key, { wastageValue: Number(e.target.value) || 0 })} />
                        <select className="input" value={l.wastageMode} onChange={(e) => updLine(l.key, { wastageMode: e.target.value as any })}>
                          <option value="pct">%</option><option value="per_gram">/g</option><option value="per_pcs">/pc</option>
                        </select>
                      </div>
                    </td>
                    <td className="text-right mono">{fmtPaise(t.taxable)}</td>
                    <td className="text-right mono">{fmtPaise(t.cgst + t.sgst + t.igst)}</td>
                    <td className="text-right mono">{fmtPaise(t.total)}</td>
                    <td className="text-right"><button className="link text-danger" onClick={() => delLine(l.key)}>×</button></td>
                  </tr>
                );
              })}
              {draft.lines.length === 0 && (
                <tr><td colSpan={10} className="py-6 text-center text-muted">no lines yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Right rail — totals + payment + post */}
      <div className="card space-y-4 h-fit sticky top-0">
        <div className="section-label">— totals ———————————</div>
        <TotalsBlock totals={totals} draft={draft} setDraft={setDraft} />
        <PaymentBlock draft={draft} setDraft={setDraft} />

        <div className="pt-3 border-t border-[var(--rule)]">
          <dl className="totals">
            <dt>Paid</dt>
            <dd>{fmtPaise(totals.paid)}</dd>
            <dt className="grand-label" style={{ fontSize: 12 }}>Balance</dt>
            <dd className={`grand-value ${totals.balance > 0 ? 'warn' : totals.balance < 0 ? 'ok' : ''}`} style={{ fontSize: 16 }}>
              {fmtPaise(totals.balance)}
            </dd>
          </dl>
        </div>

        <button
          className="btn-primary w-full"
          style={{ height: 40, fontSize: 14 }}
          onClick={post}
          disabled={postMut.loading || printMut.loading || !draft.partyId || draft.lines.length === 0}
        >
          {postMut.loading ? <Spinner label="posting" /> : printMut.loading ? <Spinner label="printing" /> : (
            <>Post &amp; print<span className="kbd">F9</span></>
          )}
        </button>
        {err && <ErrorBanner message={err} onDismiss={() => setErr('')} />}
        {postMut.error && <ErrorBanner message={postMut.error} onDismiss={postMut.clearError} />}
        {lastPosted && !err && !postMut.error && (
          <div className="text-[11px] mono tracking-wider text-[var(--moss-600)]">
            posted {lastPosted.billNo} · total {fmtPaise(lastPosted.totalPaise)}
          </div>
        )}
      </div>
    </div>
  );
}

function TotalsBlock({ totals, draft, setDraft }: any) {
  return (
    <dl className="totals">
      <dt>Subtotal</dt>            <dd>{fmtPaise(totals.subtotal)}</dd>
      {totals.cgst > 0 && (<><dt>CGST</dt><dd>{fmtPaise(totals.cgst)}</dd></>)}
      {totals.sgst > 0 && (<><dt>SGST</dt><dd>{fmtPaise(totals.sgst)}</dd></>)}
      {totals.igst > 0 && (<><dt>IGST</dt><dd>{fmtPaise(totals.igst)}</dd></>)}
      <dt>
        <span className="inline-flex items-center gap-2">
          Discount <span className="text-[10px] text-[var(--ink-300)]">₹</span>
        </span>
      </dt>
      <dd>
        <input className="input w-24 text-right mono h-7" type="number" step="0.01"
               value={draft.discount}
               onChange={(e) => setDraft((d: any) => ({ ...d, discount: Number(e.target.value) || 0 }))} />
      </dd>
      <dt>
        <span className="inline-flex items-center gap-2">
          Round-off <span className="text-[10px] text-[var(--ink-300)]">₹</span>
        </span>
      </dt>
      <dd>
        <input className="input w-24 text-right mono h-7" type="number" step="0.01"
               value={draft.roundOff}
               onChange={(e) => setDraft((d: any) => ({ ...d, roundOff: Number(e.target.value) || 0 }))} />
      </dd>
      <div className="rule-double" />
      <dt className="grand-label">Total</dt>
      <dd className="grand-value">{fmtPaise(totals.total)}</dd>
    </dl>
  );
}

function PaymentBlock({ draft, setDraft }: any) {
  return (
    <div className="pt-3 border-t border-[var(--rule)]">
      <div className="section-label mb-2">— payment ———</div>
      <dl className="totals">
        <dt>Cash</dt>
        <dd>
          <input className="input w-24 text-right mono h-7" type="number" step="0.01"
                 value={draft.cash}
                 onChange={(e) => setDraft((d: any) => ({ ...d, cash: Number(e.target.value) || 0 }))} />
        </dd>
        <dt>Bank</dt>
        <dd>
          <input className="input w-24 text-right mono h-7" type="number" step="0.01"
                 value={draft.bank}
                 onChange={(e) => setDraft((d: any) => ({ ...d, bank: Number(e.target.value) || 0 }))} />
        </dd>
      </dl>
      <div className="section-label mt-3 mb-1">— old-gold ———</div>
      <div className="grid grid-cols-4 gap-1">
        <select
          className="input col-span-1"
          value={draft.oldGold?.category ?? 'gold'}
          onChange={(e) => setDraft((d: any) => ({
            ...d, oldGold: { category: e.target.value as any, stamp: d.oldGold?.stamp ?? '22k', weight: d.oldGold?.weight ?? 0, rate: d.oldGold?.rate ?? 0 },
          }))}
        >
          <option value="gold">gold</option><option value="silver">silver</option>
        </select>
        <input className="input col-span-1 mono" placeholder="stamp"
               value={draft.oldGold?.stamp ?? ''}
               onChange={(e) => setDraft((d: any) => ({ ...d, oldGold: { ...(d.oldGold ?? { category: 'gold', weight: 0, rate: 0 }), stamp: e.target.value } }))} />
        <input className="input col-span-1 mono" placeholder="g" type="number" step="0.001"
               value={draft.oldGold?.weight ?? 0}
               onChange={(e) => setDraft((d: any) => ({ ...d, oldGold: { ...(d.oldGold ?? { category: 'gold', stamp: '22k', rate: 0 }), weight: Number(e.target.value) || 0 } }))} />
        <input className="input col-span-1 mono" placeholder="₹/g" type="number" step="0.01"
               value={draft.oldGold?.rate ?? 0}
               onChange={(e) => setDraft((d: any) => ({ ...d, oldGold: { ...(d.oldGold ?? { category: 'gold', stamp: '22k', weight: 0 }), rate: Number(e.target.value) || 0 } }))} />
      </div>
    </div>
  );
}

