import { useState } from 'react';
import { CH, invoke } from '@/lib/ipc';
import { useMutation } from '@/lib/useAsync';
import { ErrorBanner, Spinner } from '@/components/Status';

type Step = { name: string; ok: boolean; ms: number; detail?: string };
type Report = { steps: Step[]; passed: number; failed: number };

export function DevScreen() {
  const [report, setReport] = useState<Report | null>(null);
  const mut = useMutation<void, Report>(() => invoke(CH.devSmoke));

  async function run() {
    setReport(null);
    try { setReport(await mut.run()); } catch { /* surfaced */ }
  }

  return (
    <div className="max-w-4xl space-y-4">
      <div>
        <h2 className="text-base font-medium">Developer smoke test</h2>
        <p className="text-sm text-muted">
          Runs every Phase 0–2 code path against a live copy of your DB with synthetic parties
          + items, verifies invariants (line math, ledger balances, stock, GST split, FTS5),
          then deletes the test rows. Safe to re-run.
        </p>
      </div>

      <button className="btn-primary" onClick={run} disabled={mut.loading}>
        {mut.loading ? <Spinner label="running suite…" /> : 'Run smoke test'}
      </button>
      {mut.error && <ErrorBanner message={mut.error} onDismiss={mut.clearError} />}

      {report && (
        <div className="space-y-3">
          <div className="flex gap-4 text-sm">
            <span className={report.failed === 0 ? 'text-success font-medium' : 'text-danger font-medium'}>
              {report.failed === 0 ? '✓ ALL PASSED' : `✗ ${report.failed} FAILED`}
            </span>
            <span className="text-muted">{report.passed} passed / {report.steps.length} total</span>
            <span className="text-muted mono">
              {report.steps.reduce((s, x) => s + x.ms, 0)} ms
            </span>
          </div>
          <table className="w-full text-xs">
            <thead className="text-muted border-b border-border">
              <tr>
                <th className="text-left py-1 w-12">Status</th>
                <th className="text-left">Step</th>
                <th className="text-right w-16">ms</th>
                <th className="text-left">Detail</th>
              </tr>
            </thead>
            <tbody>
              {report.steps.map((s, i) => (
                <tr key={i} className={`border-b border-border/50 ${s.ok ? '' : 'bg-danger/5'}`}>
                  <td className="py-1"><span className={s.ok ? 'text-success' : 'text-danger'}>{s.ok ? '✓' : '✗'}</span></td>
                  <td>{s.name}</td>
                  <td className="text-right mono">{s.ms}</td>
                  <td className={`mono ${s.ok ? 'text-muted' : 'text-danger'}`}>{s.detail ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
