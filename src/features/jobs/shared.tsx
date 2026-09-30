// Small primitives shared by the three job tabs.

type StatusKind = 'neutral' | 'ok' | 'warn' | 'err' | 'gold';

const STATUS_COLOR: Record<string, StatusKind> = {
  open: 'gold', received: 'gold', in_progress: 'warn', ready: 'ok',
  sold: 'ok', delivered: 'ok', returned: 'neutral', cancelled: 'neutral',
};

export function StatusChip({ status }: { status: string }) {
  const kind = STATUS_COLOR[status] ?? 'neutral';
  const map: Record<StatusKind, { bg: string; border: string; color: string }> = {
    neutral: { bg: 'rgba(122,110,100,0.10)', border: 'rgba(122,110,100,0.30)', color: 'var(--ink-500)' },
    ok:      { bg: 'rgba(74,107,58,0.10)',   border: 'rgba(74,107,58,0.40)',   color: 'var(--moss-600)' },
    warn:    { bg: 'rgba(192,130,30,0.10)',  border: 'rgba(192,130,30,0.40)',  color: 'var(--amber-500)' },
    err:     { bg: 'rgba(160,44,44,0.10)',   border: 'rgba(160,44,44,0.35)',   color: 'var(--rose-500)' },
    gold:    { bg: 'rgba(184,137,46,0.12)',  border: 'rgba(184,137,46,0.35)',  color: 'var(--gold-700)' },
  };
  const s = map[kind];
  return (
    <span
      className="mono"
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: 3,
        border: `1px solid ${s.border}`,
        background: s.bg,
        color: s.color,
        fontSize: 10,
        letterSpacing: '0.05em',
        textTransform: 'uppercase',
        lineHeight: 1.3,
        whiteSpace: 'nowrap',
      }}
    >
      {status.replace('_', ' ')}
    </span>
  );
}

export function fmtDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });
}

export function fmtWhen(ts: number): string {
  return new Date(ts * 1000).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}
