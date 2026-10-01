/* Backup — one-button "seal the day". Ported to v2 primitives. */

import { CH, invoke } from '@/lib/ipc';
import { useMutation } from '@/lib/useAsync';
import { Sheet, Button, toast } from '@/components/ui';
import { stamp as playStamp } from '@/lib/sound';

export function BackupScreen() {
  const mut = useMutation<void, { path: string; bytes: number }>(() => invoke(CH.backupNow));

  async function run() {
    try {
      const r = await mut.run();
      playStamp();
      toast.success('Ledger sealed', { body: `${(r.bytes / 1024).toFixed(1)} KiB · ${r.path}`, duration: 6000 });
    } catch { /* surfaced */ }
  }

  return (
    <div className="ds-v2 mood-book" style={{ padding: 'var(--container-pad)', height: '100%', boxSizing: 'border-box' }}>
      <div style={{ maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 'var(--s4)' }}>
        <Sheet title="Seal the day">
          <div style={{ fontSize: 'var(--t-sm)', color: 'var(--text-mute)', marginBottom: 'var(--s3)' }}>
            The ledger seals itself every night at 02:00 and again when you close the counter.
            Sealed copies live in{' '}
            <span style={{ fontFamily: 'var(--font-mono)' }}>%APPDATA%/jewelzz/backups</span>{' '}
            — the last 14 are kept.
          </div>
          <Button variant="primary" onClick={run} disabled={mut.loading}>
            {mut.loading ? 'Sealing…' : 'Seal the day'}
          </Button>
          {mut.error && (
            <div className="alert" style={{ marginTop: 'var(--s3)' }}>
              <span style={{ whiteSpace: 'pre-wrap' }}>{mut.error}</span>
              <button className="alert__dismiss" onClick={mut.clearError} aria-label="dismiss">×</button>
            </div>
          )}
        </Sheet>
      </div>
    </div>
  );
}
