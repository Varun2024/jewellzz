/* Reports — Registers / GSTR-1 / GSTR-3B / HSN. Ported to v2 primitives. */

import { useState } from 'react';
import { CH, invoke } from '@/lib/ipc';
import { useMutation, useAsync } from '@/lib/useAsync';
import {
  Sheet, Button, Tabs, Field, Rupee, Pill, Progress, Empty,
} from '@/components/ui';

type Tab = 'registers' | 'gstr1' | 'gstr3b' | 'hsn';

function toTs(v: string): number | undefined {
  if (!v) return undefined;
  const d = new Date(v);
  return isNaN(d.getTime()) ? undefined : Math.floor(d.getTime() / 1000);
}

export function ReportsScreen() {
  const [tab, setTab] = useState<Tab>('registers');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const range = { fromTs: toTs(from), toTs: toTs(to) };

  return (
    <div className="ds-v2" style={{ padding: 'var(--container-pad)', height: '100%', boxSizing: 'border-box' }}>
      <div style={{ maxWidth: 1200, display: 'flex', flexDirection: 'column', gap: 'var(--s4)' }}>
        <Tabs<Tab>
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'registers', label: 'Registers' },
            { value: 'gstr1',     label: 'GSTR-1' },
            { value: 'gstr3b',    label: 'GSTR-3B' },
            { value: 'hsn',       label: 'HSN summary' },
          ]}
        />

        <div style={{ display: 'grid', gridTemplateColumns: '160px 160px 1fr', gap: 'var(--s3)', alignItems: 'end' }}>
          <Field label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <Field label="To"   type="date" value={to}   onChange={(e) => setTo(e.target.value)} />
          <div />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s3)' }}>
          {tab === 'registers' && <RegistersTab range={range} />}
          {tab === 'gstr1'     && <Gstr1Tab     range={range} />}
          {tab === 'gstr3b'    && <Gstr3bTab    range={range} />}
          {tab === 'hsn'       && <HsnTab       range={range} />}
        </div>
      </div>
    </div>
  );
}

/* ------------------------- Registers ------------------------- */
function RegistersTab({ range }: { range: any }) {
  const salesMut = useMutation<any, { path: string }>((r) => invoke(CH.exportSalesCsv, r));
  const purMut   = useMutation<any, { path: string }>((r) => invoke(CH.exportPurchasesCsv, r));
  const [msg, setMsg] = useState('');
  async function run(fn: any) {
    setMsg('');
    try { const r = await fn.run(range); setMsg(r.path); } catch { /* surfaced */ }
  }
  return (
    <Sheet title="CSV exports">
      <div style={{ color: 'var(--text-mute)', fontSize: 'var(--t-sm)', marginBottom: 'var(--s3)' }}>
        Sales and purchase registers as CSV. Opens directly in Excel / Numbers.
      </div>
      <div style={{ display: 'flex', gap: 'var(--s2)' }}>
        <Button variant="primary" onClick={() => run(salesMut)} disabled={salesMut.loading}>
          {salesMut.loading ? 'Exporting…' : 'Export sales register'}
        </Button>
        <Button onClick={() => run(purMut)} disabled={purMut.loading}>
          {purMut.loading ? 'Exporting…' : 'Export purchase register'}
        </Button>
      </div>
      {salesMut.error && <InlineAlert message={salesMut.error} onDismiss={salesMut.clearError} />}
      {purMut.error   && <InlineAlert message={purMut.error}   onDismiss={purMut.clearError}   />}
      {msg && (
        <div style={{
          marginTop: 'var(--s3)',
          padding: 'var(--s2) var(--s3)',
          background: 'var(--surface-hi)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-1)',
          fontFamily: 'var(--font-mono)', fontSize: 'var(--t-sm)',
          wordBreak: 'break-all',
          color: 'var(--text-mute)',
        }}>
          saved · {msg}
        </div>
      )}
    </Sheet>
  );
}

/* --------------------------- GSTR-1 -------------------------- */
function Gstr1Tab({ range }: { range: any }) {
  const view = useAsync<any[]>(() => invoke(CH.gstGstr1View, range), [range.fromTs, range.toTs]);
  const csv  = useMutation<any, { path: string }>((r) => invoke(CH.gstGstr1Csv, r));
  const [msg, setMsg] = useState('');
  async function download() {
    setMsg('');
    try { const r = await csv.run(range); setMsg(r.path); } catch { /* surfaced */ }
  }
  const rows = view.data ?? [];
  const b2b = rows.filter((r) => r.invoiceType === 'B2B').length;
  const b2c = rows.filter((r) => r.invoiceType === 'B2C').length;

  return (
    <Sheet
      title="GSTR-1 · outward supplies"
      action={
        <Button variant="primary" onClick={download} disabled={csv.loading}>
          {csv.loading ? 'Exporting…' : 'Export CSV'}
        </Button>
      }
      flush
    >
      {csv.error  && <div style={{ padding: 12 }}><InlineAlert message={csv.error}  onDismiss={csv.clearError} /></div>}
      {view.error && <div style={{ padding: 12 }}><InlineAlert message={view.error} onDismiss={() => view.reload()} /></div>}
      {msg && <SavedBanner path={msg} />}
      {view.loading ? <div style={{ padding: 16 }}><LoadingState label="computing GSTR-1…" /></div> : (
        <>
          <div style={{
            padding: 'var(--s3) var(--container-pad)',
            borderBottom: '1px solid var(--border)',
            fontSize: 'var(--t-sm)', color: 'var(--text-mute)',
            display: 'flex', gap: 8, alignItems: 'center',
          }}>
            <span>{rows.length} rows</span>
            <span>·</span>
            <Pill tone="accent">B2B {b2b}</Pill>
            <Pill>B2C {b2c}</Pill>
            <span style={{ marginLeft: 'auto' }}>one row per (invoice, rate)</span>
          </div>
          {rows.length === 0 ? (
            <Empty mark="bell" title="No outward invoices in range" />
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 60 }}>Type</th>
                  <th style={{ width: 110 }}>Bill</th>
                  <th style={{ width: 110 }}>Date</th>
                  <th>Buyer</th>
                  <th style={{ width: 160 }}>GSTIN</th>
                  <th className="num" style={{ width: 70 }}>Rate %</th>
                  <th className="num" style={{ width: 130 }}>Taxable</th>
                  <th className="num" style={{ width: 110 }}>CGST</th>
                  <th className="num" style={{ width: 110 }}>SGST</th>
                  <th className="num" style={{ width: 110 }}>IGST</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td><Pill tone={r.invoiceType === 'B2B' ? 'accent' : 'default'}>{r.invoiceType}</Pill></td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-sm)' }}>{r.billNo}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-sm)', color: 'var(--text-mute)' }}>
                      {new Date(r.ts * 1000).toLocaleDateString('en-IN')}
                    </td>
                    <td>{r.buyerName}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-sm)', color: 'var(--text-mute)' }}>
                      {r.buyerGstin || '—'}
                    </td>
                    <td className="num">{r.ratePct.toFixed(2)}</td>
                    <td className="num"><Rupee paise={r.taxablePaise} /></td>
                    <td className="num">{r.cgstPaise ? <Rupee paise={r.cgstPaise} /> : ''}</td>
                    <td className="num">{r.sgstPaise ? <Rupee paise={r.sgstPaise} /> : ''}</td>
                    <td className="num">{r.igstPaise ? <Rupee paise={r.igstPaise} /> : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </Sheet>
  );
}

/* --------------------------- GSTR-3B ------------------------- */
function Gstr3bTab({ range }: { range: any }) {
  const view = useAsync<any>(() => invoke(CH.gstGstr3bView, range), [range.fromTs, range.toTs]);
  const csv  = useMutation<any, { path: string }>((r) => invoke(CH.gstGstr3bCsv, r));
  const [msg, setMsg] = useState('');
  async function download() {
    setMsg('');
    try { const r = await csv.run(range); setMsg(r.path); } catch {}
  }
  const d = view.data;

  return (
    <Sheet
      title="GSTR-3B · monthly summary"
      action={
        <Button variant="primary" onClick={download} disabled={csv.loading}>
          {csv.loading ? 'Exporting…' : 'Export CSV'}
        </Button>
      }
    >
      {csv.error  && <InlineAlert message={csv.error}  onDismiss={csv.clearError} />}
      {view.error && <InlineAlert message={view.error} onDismiss={() => view.reload()} />}
      {msg && <SavedBanner path={msg} />}
      {view.loading && <LoadingState label="computing 3B…" />}
      {!view.loading && d && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--s3)' }}>
          <SummaryCard title="3.1 (a) Outward taxable (total)" data={d.outward} />
          <SummaryCard title={`3.1 (a) B2B · ${d.outwardB2B.count} invoices`} data={d.outwardB2B} />
          <SummaryCard title={`3.1 (a) B2C · ${d.outwardB2C.count} invoices`} data={d.outwardB2C} />
          <SummaryCard title="4 ITC — input tax credit" data={d.inwardITC} />
        </div>
      )}
      <div style={{ marginTop: 'var(--s3)', fontSize: 'var(--t-sm)', color: 'var(--text-mute)' }}>
        Nil / exempt / zero-rated / reverse-charge sections aren't computed here — adjust in the CA-side portal filing.
      </div>
    </Sheet>
  );
}

function SummaryCard({ title, data }: { title: string; data: any }) {
  return (
    <div style={{
      border: '1px solid var(--border)',
      background: 'var(--surface)',
      borderRadius: 'var(--radius-1)',
      padding: 'var(--s3)',
      display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      <div style={{ fontSize: 'var(--t-sm)', color: 'var(--text-mute)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 'var(--s2)' }}>
        {title}
      </div>
      <KV label="Taxable" v={data.taxablePaise} />
      <KV label="CGST"    v={data.cgstPaise} />
      <KV label="SGST"    v={data.sgstPaise} />
      <KV label="IGST"    v={data.igstPaise} />
      {data.totalPaise !== undefined && (
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          paddingTop: 'var(--s2)', marginTop: 'var(--s2)',
          borderTop: '1px solid var(--accent)',
          fontWeight: 500,
        }}>
          <span>Invoice total</span>
          <span><Rupee paise={data.totalPaise} /></span>
        </div>
      )}
    </div>
  );
}

function KV({ label, v }: { label: string; v: number }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--t-sm)' }}>
      <span style={{ color: 'var(--text-mute)' }}>{label}</span>
      <span><Rupee paise={v} /></span>
    </div>
  );
}

/* ----------------------------- HSN --------------------------- */
function HsnTab({ range }: { range: any }) {
  const view = useAsync<any[]>(() => invoke(CH.gstHsnView, range), [range.fromTs, range.toTs]);
  const csv  = useMutation<any, { path: string }>((r) => invoke(CH.gstHsnCsv, r));
  const [msg, setMsg] = useState('');
  async function download() {
    setMsg('');
    try { const r = await csv.run(range); setMsg(r.path); } catch {}
  }

  return (
    <Sheet
      title="HSN summary"
      action={
        <Button variant="primary" onClick={download} disabled={csv.loading}>
          {csv.loading ? 'Exporting…' : 'Export CSV'}
        </Button>
      }
      flush
    >
      {csv.error  && <div style={{ padding: 12 }}><InlineAlert message={csv.error}  onDismiss={csv.clearError} /></div>}
      {view.error && <div style={{ padding: 12 }}><InlineAlert message={view.error} onDismiss={() => view.reload()} /></div>}
      {msg && <SavedBanner path={msg} />}
      {view.loading ? <div style={{ padding: 16 }}><LoadingState label="computing HSN…" /></div> : (view.data?.length ?? 0) === 0 ? (
        <Empty mark="bell" title="No sale lines in range" />
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th style={{ width: 100 }}>HSN</th>
              <th style={{ width: 60 }}>UQC</th>
              <th className="num" style={{ width: 60 }}>Qty</th>
              <th className="num" style={{ width: 100 }}>Weight (g)</th>
              <th className="num" style={{ width: 70 }}>Rate %</th>
              <th className="num" style={{ width: 130 }}>Value</th>
              <th className="num" style={{ width: 130 }}>Taxable</th>
              <th className="num" style={{ width: 110 }}>CGST</th>
              <th className="num" style={{ width: 110 }}>SGST</th>
              <th className="num" style={{ width: 110 }}>IGST</th>
            </tr>
          </thead>
          <tbody>
            {(view.data ?? []).map((r, i) => (
              <tr key={i}>
                <td style={{ fontFamily: 'var(--font-mono)' }}>{r.hsn || '—'}</td>
                <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-mute)' }}>{r.uqc}</td>
                <td className="num">{r.totalQty}</td>
                <td className="num">{r.totalWeightG.toFixed(3)}</td>
                <td className="num">{r.ratePct.toFixed(2)}</td>
                <td className="num"><Rupee paise={r.totalValuePaise} /></td>
                <td className="num"><Rupee paise={r.taxablePaise} /></td>
                <td className="num">{r.cgstPaise ? <Rupee paise={r.cgstPaise} /> : ''}</td>
                <td className="num">{r.sgstPaise ? <Rupee paise={r.sgstPaise} /> : ''}</td>
                <td className="num">{r.igstPaise ? <Rupee paise={r.igstPaise} /> : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Sheet>
  );
}

/* ----------------------------- bits -------------------------- */

function LoadingState({ label }: { label: string }) {
  return (
    <div>
      <Progress />
      <div style={{ marginTop: 8, fontSize: 'var(--t-sm)', color: 'var(--text-mute)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {label}
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
function SavedBanner({ path }: { path: string }) {
  return (
    <div style={{
      margin: '12px 16px',
      padding: 'var(--s2) var(--s3)',
      background: 'var(--surface-hi)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-1)',
      fontFamily: 'var(--font-mono)', fontSize: 'var(--t-sm)',
      wordBreak: 'break-all',
      color: 'var(--text-mute)',
    }}>
      saved · {path}
    </div>
  );
}
