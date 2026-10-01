/* Shared chip + date helpers for the three Jobs tabs. v2 primitives. */

import { Pill } from '@/components/ui';

type Tone = 'default' | 'accent' | 'pos' | 'neg';

const STATUS_TONE: Record<string, Tone> = {
  open:        'accent',
  received:    'accent',
  in_progress: 'accent',
  ready:       'pos',
  sold:        'pos',
  delivered:   'pos',
  returned:    'default',
  cancelled:   'default',
};

export function StatusChip({ status }: { status: string }) {
  const tone = STATUS_TONE[status] ?? 'default';
  return <Pill tone={tone}>{status.replace('_', ' ')}</Pill>;
}

export function fmtDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });
}

export function fmtWhen(ts: number): string {
  return new Date(ts * 1000).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}
