import { useState } from 'react';
import { CH, invoke } from '@/lib/ipc';
import { useMutation, useAsync } from '@/lib/useAsync';
import { fmtPaise } from '@/lib/format';
import { ErrorBanner, Spinner, LoadingBlock, EmptyState } from '@/components/Status';

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
    <div className="max-w-6xl space-y-5">
      <div className="tabs">
        {(['registers', 'gstr1', 'gstr3b', 'hsn'] as Tab[]).map((t) => (
          <button key={t} className="tab" data-active={tab === t} onClick={() => setTab(t)}>
            {t === 'gstr1' ? 'GSTR-1' : t === 'gstr3b' ? 'GSTR-3B' : t === 'hsn' ? 'HSN summary' : 'Registers'}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2 max-w-sm">
        <label className="text-xs text-muted">From
          <input type="date" className="input w-full" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="text-xs text-muted">To
          <input type="date" className="input w-full" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
      </div>

      {tab === 'registers' && <RegistersTab range={range} />}
      {tab === 'gstr1' && <Gstr1Tab range={range} />}
      {tab === 'gstr3b' && <Gstr3bTab range={range} />}
      {tab === 'hsn' && <HsnTab range={range} />}
    </div>
  );
}

function RegistersTab({ range }: { range: any }) {
  const salesMut = useMutation<any, { path: string }>((r) => invoke(CH.exportSalesCsv, r));
  const purMut = useMutation<any, { path: string }>((r) => invoke(CH.exportPurchasesCsv, r));
  const [msg, setMsg] = useState('');
  async function run(fn: any) {
    setMsg('');
    try { const r = await fn.run(range); setMsg(`saved ${r.path}`); } catch { /* surfaced */ }
  }
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">Sales / purchase register CSV.</p>
      <div className="flex gap-2">
        <button className="btn-primary" onClick={() => run(salesMut)} disabled={salesMut.loading}>
          {salesMut.loading ? <Spinner label="exporting…" /> : 'Export sales register'}
        </button>
        <button className="btn" onClick={() => run(purMut)} disabled={purMut.loading}>
          {purMut.loading ? <Spinner label="exporting…" /> : 'Export purchase register'}
        </button>
      </div>
      {salesMut.error && <ErrorBanner message={salesMut.error} onDismiss={salesMut.clearError} />}
      {purMut.error && <ErrorBanner message={purMut.error} onDismiss={purMut.clearError} />}
      {msg && <div className="text-xs mono text-muted break-all">{msg}</div>}
    </div>
  );
}

function Gstr1Tab({ range }: { range: any }) {
  const view = useAsync<any[]>(() => invoke(CH.gstGstr1View, range), [range.fromTs, range.toTs]);
  const csv = useMutation<any, { path: string }>((r) => invoke(CH.gstGstr1Csv, r));
  const [msg, setMsg] = useState('');
  async function download() {
    setMsg('');
    try { const r = await csv.run(range); setMsg(`saved ${r.path}`); } catch { /* surfaced */ }
  }

  const rows = view.data ?? [];
  const b2b = rows.filter((r) => r.invoiceType === 'B2B');
  const b2c = rows.filter((r) => r.invoiceType === 'B2C');

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <button className="btn-primary" onClick={download} disabled={csv.loading}>
          {csv.loading ? <Spinner label="exporting…" /> : 'Export GSTR-1 CSV'}
        </button>
      </div>
      {csv.error && <ErrorBanner message={csv.error} onDismiss={csv.clearError} />}
      {view.error && <ErrorBanner message={view.error} onDismiss={() => view.reload()} />}
      {msg && <div className="text-xs mono text-muted break-all">{msg}</div>}
      {view.loading ? <LoadingBlock label="computing…" /> : (
        <>
          <div className="text-xs text-muted">{rows.length} rows — B2B: {b2b.length}, B2C: {b2c.length}. One row per (invoice, rate).</div>
          <table className="w-full text-xs">
            <thead className="text-muted border-b border-border">
              <tr>
                <th className="text-left py-1">Type</th>
                <th className="text-left">Bill</th>
                <th className="text-left">Date</th>
                <th className="text-left">Buyer</th>
                <th className="text-left">GSTIN</th>
                <th className="text-right">Rate %</th>
                <th className="text-right">Taxable</th>
                <th className="text-right">CGST</th>
                <th className="text-right">SGST</th>
                <th className="text-right">IGST</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b border-border/50">
                  <td className={`py-1 ${r.invoiceType === 'B2B' ? 'text-accent' : 'text-muted'}`}>{r.invoiceType}</td>
                  <td className="mono">{r.billNo}</td>
                  <td className="mono">{new Date(r.ts * 1000).toLocaleDateString('en-IN')}</td>
                  <td>{r.buyerName}</td>
                  <td className="mono text-muted">{r.buyerGstin || '—'}</td>
                  <td className="text-right mono">{r.ratePct.toFixed(2)}</td>
                  <td className="text-right mono">{fmtPaise(r.taxablePaise)}</td>
                  <td className="text-right mono">{r.cgstPaise ? fmtPaise(r.cgstPaise) : ''}</td>
                  <td className="text-right mono">{r.sgstPaise ? fmtPaise(r.sgstPaise) : ''}</td>
                  <td className="text-right mono">{r.igstPaise ? fmtPaise(r.igstPaise) : ''}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={10}><EmptyState>no outward invoices in range</EmptyState></td></tr>}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

function Gstr3bTab({ range }: { range: any }) {
  const view = useAsync<any>(() => invoke(CH.gstGstr3bView, range), [range.fromTs, range.toTs]);
  const csv = useMutation<any, { path: string }>((r) => invoke(CH.gstGstr3bCsv, r));
  const [msg, setMsg] = useState('');
  async function download() { setMsg(''); try { const r = await csv.run(range); setMsg(`saved ${r.path}`); } catch {} }

  const d = view.data;
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <button className="btn-primary" onClick={download} disabled={csv.loading}>
          {csv.loading ? <Spinner label="exporting…" /> : 'Export GSTR-3B CSV'}
        </button>
      </div>
      {csv.error && <ErrorBanner message={csv.error} onDismiss={csv.clearError} />}
      {view.error && <ErrorBanner message={view.error} onDismiss={() => view.reload()} />}
      {msg && <div className="text-xs mono text-muted break-all">{msg}</div>}
      {view.loading ? <LoadingBlock label="computing…" /> : d && (
        <div className="grid grid-cols-2 gap-4 max-w-4xl">
          <SummaryCard title="3.1 (a) Outward taxable supplies (total)" data={d.outward} />
          <SummaryCard title={`3.1 (a) B2B (${d.outwardB2B.count} invoices)`} data={d.outwardB2B} />
          <SummaryCard title={`3.1 (a) B2C (${d.outwardB2C.count} invoices)`} data={d.outwardB2C} />
          <SummaryCard title="4 ITC (input tax credit from purchases)" data={d.inwardITC} />
        </div>
      )}
      <p className="text-xs text-muted">
        Nil / exempt / zero-rated / reverse-charge sections are not in MVP scope. Adjust in the CA-side portal filing.
      </p>
    </div>
  );
}

function SummaryCard({ title, data }: { title: string; data: any }) {
  return (
    <div className="bg-panel border border-border rounded p-3 space-y-1 text-sm">
      <div className="text-xs text-muted font-medium">{title}</div>
      <Row label="Taxable" v={data.taxablePaise} />
      <Row label="CGST" v={data.cgstPaise} />
      <Row label="SGST" v={data.sgstPaise} />
      <Row label="IGST" v={data.igstPaise} />
      {data.totalPaise !== undefined && (
        <div className="flex justify-between font-medium pt-1 border-t border-border">
          <span>Invoice total</span><span className="mono">{fmtPaise(data.totalPaise)}</span>
        </div>
      )}
    </div>
  );
}
function Row({ label, v }: { label: string; v: number }) {
  return <div className="flex justify-between"><span className="text-muted">{label}</span><span className="mono">{fmtPaise(v)}</span></div>;
}

function HsnTab({ range }: { range: any }) {
  const view = useAsync<any[]>(() => invoke(CH.gstHsnView, range), [range.fromTs, range.toTs]);
  const csv = useMutation<any, { path: string }>((r) => invoke(CH.gstHsnCsv, r));
  const [msg, setMsg] = useState('');
  async function download() { setMsg(''); try { const r = await csv.run(range); setMsg(`saved ${r.path}`); } catch {} }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <button className="btn-primary" onClick={download} disabled={csv.loading}>
          {csv.loading ? <Spinner label="exporting…" /> : 'Export HSN CSV'}
        </button>
      </div>
      {csv.error && <ErrorBanner message={csv.error} onDismiss={csv.clearError} />}
      {view.error && <ErrorBanner message={view.error} onDismiss={() => view.reload()} />}
      {msg && <div className="text-xs mono text-muted break-all">{msg}</div>}
      {view.loading ? <LoadingBlock label="computing…" /> : (
        <table className="w-full text-xs">
          <thead className="text-muted border-b border-border">
            <tr>
              <th className="text-left py-1">HSN</th>
              <th className="text-left">UQC</th>
              <th className="text-right">Qty</th>
              <th className="text-right">Weight (g)</th>
              <th className="text-right">Rate %</th>
              <th className="text-right">Value</th>
              <th className="text-right">Taxable</th>
              <th className="text-right">CGST</th>
              <th className="text-right">SGST</th>
              <th className="text-right">IGST</th>
            </tr>
          </thead>
          <tbody>
            {(view.data ?? []).map((r, i) => (
              <tr key={i} className="border-b border-border/50">
                <td className="py-1 mono">{r.hsn || '—'}</td>
                <td className="mono text-muted">{r.uqc}</td>
                <td className="text-right mono">{r.totalQty}</td>
                <td className="text-right mono">{r.totalWeightG.toFixed(3)}</td>
                <td className="text-right mono">{r.ratePct.toFixed(2)}</td>
                <td className="text-right mono">{fmtPaise(r.totalValuePaise)}</td>
                <td className="text-right mono">{fmtPaise(r.taxablePaise)}</td>
                <td className="text-right mono">{r.cgstPaise ? fmtPaise(r.cgstPaise) : ''}</td>
                <td className="text-right mono">{r.sgstPaise ? fmtPaise(r.sgstPaise) : ''}</td>
                <td className="text-right mono">{r.igstPaise ? fmtPaise(r.igstPaise) : ''}</td>
              </tr>
            ))}
            {(view.data?.length ?? 0) === 0 && <tr><td colSpan={10}><EmptyState>no sale lines in range</EmptyState></td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}
