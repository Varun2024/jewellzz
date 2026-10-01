/* Dev — smoke test runner. Ported to v2 primitives. */

import { useState } from 'react';
import { CH, invoke } from '@/lib/ipc';
import { useMutation } from '@/lib/useAsync';
import { Sheet, Button, Pill, Progress, Num } from '@/components/ui';

type Step = { name: string; ok: boolean; ms: number; detail?: string };
type Report = { steps: Step[]; passed: number; failed: number };

export function DevScreen() {
  const [report, setReport] = useState<Report | null>(null);
  const mut = useMutation<void, Report>(() => invoke(CH.devSmoke));

  async function run() {
    setReport(null);
    try { setReport(await mut.run()); } catch { /* surfaced */ }
  }

  const totalMs = report?.steps.reduce((s, x) => s + x.ms, 0) ?? 0;

  return (
    <div className="ds-v2 mood-book" style={{ padding: 'var(--container-pad)', height: '100%', overflow: 'auto', boxSizing: 'border-box' }}>
      <div style={{ maxWidth: 1000, display: 'flex', flexDirection: 'column', gap: 'var(--s4)' }}>
        <Sheet
          title="Developer smoke test"
          action={
            <Button variant="primary" onClick={run} disabled={mut.loading}>
              {mut.loading ? 'Running…' : 'Run smoke test'}
            </Button>
          }
        >
          <div style={{ fontSize: 'var(--t-sm)', color: 'var(--text-mute)' }}>
            Runs every Phase 0–2 code path against a live copy of your DB with synthetic parties
            + items, verifies invariants (line math, ledger balances, stock, GST split, FTS5),
            then deletes the test rows. Safe to re-run.
          </div>
          {mut.loading && <div style={{ marginTop: 'var(--s3)' }}><Progress /></div>}
          {mut.error && (
            <div className="alert" style={{ marginTop: 'var(--s3)' }}>
              <span style={{ whiteSpace: 'pre-wrap' }}>{mut.error}</span>
              <button className="alert__dismiss" onClick={mut.clearError} aria-label="dismiss">×</button>
            </div>
          )}
        </Sheet>

        {report && (
          <Sheet
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s3)' }}>
                <span>Report</span>
                <Pill tone={report.failed === 0 ? 'pos' : 'neg'}>
                  {report.failed === 0 ? 'ALL PASSED' : `${report.failed} FAILED`}
                </Pill>
                <span style={{ fontSize: 'var(--t-sm)', color: 'var(--text-mute)', fontWeight: 400 }}>
                  <Num value={report.passed} /> passed · <Num value={report.steps.length} /> total · <Num value={totalMs} /> ms
                </span>
              </div>
            }
            flush
          >
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 60 }}>Status</th>
                  <th>Step</th>
                  <th className="num" style={{ width: 80 }}>ms</th>
                  <th>Detail</th>
                </tr>
              </thead>
              <tbody>
                {report.steps.map((s, i) => (
                  <tr
                    key={i}
                    style={s.ok ? undefined : {
                      background: 'color-mix(in oklab, var(--neg) 6%, transparent)',
                    }}
                  >
                    <td>
                      <span style={{
                        color: s.ok ? 'var(--pos)' : 'var(--neg)',
                        fontWeight: 600,
                      }}>
                        {s.ok ? '✓' : '✗'}
                      </span>
                    </td>
                    <td>{s.name}</td>
                    <td className="num" style={{ fontFamily: 'var(--font-mono)' }}>{s.ms}</td>
                    <td style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 'var(--t-sm)',
                      color: s.ok ? 'var(--text-mute)' : 'var(--neg)',
                    }}>
                      {s.detail ?? ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Sheet>
        )}
      </div>
    </div>
  );
}
