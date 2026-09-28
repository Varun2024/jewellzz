import { useState } from 'react';
import { CH, invoke } from '@/lib/ipc';
import { useMutation } from '@/lib/useAsync';
import { ErrorBanner, Spinner } from '@/components/Status';

export function BackupScreen() {
  const [msg, setMsg] = useState('');
  const mut = useMutation<void, { path: string; bytes: number }>(() => invoke(CH.backupNow));

  async function run() {
    setMsg('');
    try {
      const r = await mut.run();
      setMsg(`saved ${r.path} (${(r.bytes / 1024).toFixed(1)} KiB)`);
    } catch { /* surfaced */ }
  }

  return (
    <div className="max-w-xl space-y-3">
      <p className="text-sm text-muted">
        Daily auto-backup runs at 02:00 local. A shutdown copy is also written on app close.
        Backups live in <span className="mono">%APPDATA%/jewelzz/backups</span>. Retention: 14 files.
      </p>
      <button className="btn-primary" onClick={run} disabled={mut.loading}>
        {mut.loading ? <Spinner label="backing up…" /> : 'Backup now'}
      </button>
      {mut.error && <ErrorBanner message={mut.error} onDismiss={mut.clearError} />}
      {msg && <div className="text-xs mono break-all">{msg}</div>}
    </div>
  );
}
