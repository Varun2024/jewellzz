/* Toast — tiny notification stack mounted once at the app root.
 *
 * Usage from anywhere:
 *   import { toast } from '@/components/ui';
 *   toast.success('Bill posted');
 *   toast.error('Could not save');
 *   toast.info('Backup running…', { duration: 8000 });
 *   toast.success('Rate updated', { action: { label: 'undo', onClick: ... }});
 *
 * No external deps; a 40-line event emitter + useSyncExternalStore. Toasts
 * stack bottom-right, newest on top. Max 5 visible, older ones auto-shift
 * off when the stack fills.
 */

import { useEffect, useSyncExternalStore } from 'react';
import { tick as playTick, drop as playDrop } from '@/lib/sound';

type Tone = 'success' | 'error' | 'info';

export interface ToastEntry {
  id: number;
  tone: Tone;
  title: string;
  body?: string;
  duration: number;
  action?: { label: string; onClick: () => void };
}

type Listener = () => void;

const MAX_VISIBLE = 5;
const DEFAULT_DURATION = 4000;

let entries: ToastEntry[] = [];
const listeners = new Set<Listener>();
let nextId = 1;

function emit() {
  for (const l of listeners) l();
}

function subscribe(l: Listener) {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

function push(tone: Tone, title: string, opts?: { body?: string; duration?: number; action?: ToastEntry['action'] }): number {
  const id = nextId++;
  const entry: ToastEntry = {
    id,
    tone,
    title,
    body: opts?.body,
    duration: opts?.duration ?? DEFAULT_DURATION,
    action: opts?.action,
  };
  entries = [entry, ...entries].slice(0, MAX_VISIBLE);
  emit();
  // Short-form audio cue — honoured only if the user opted into sound.
  if (tone === 'error') playTick();
  else playDrop();
  if (entry.duration > 0) {
    setTimeout(() => dismiss(id), entry.duration);
  }
  return id;
}

function dismiss(id: number) {
  entries = entries.filter((e) => e.id !== id);
  emit();
}

export const toast = {
  success: (title: string, opts?: { body?: string; duration?: number; action?: ToastEntry['action'] }) => push('success', title, opts),
  error:   (title: string, opts?: { body?: string; duration?: number; action?: ToastEntry['action'] }) => push('error',   title, opts),
  info:    (title: string, opts?: { body?: string; duration?: number; action?: ToastEntry['action'] }) => push('info',    title, opts),
  dismiss,
};

function getSnapshot() { return entries; }

/* Mount once at the app root. The Toaster carries its own `.ds-v2` so it
 * works regardless of which screen is active. */
export function Toaster() {
  const list = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  // Esc dismisses the newest toast — small quality-of-life.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && list.length > 0) {
        dismiss(list[0].id);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [list]);

  if (list.length === 0) return null;

  return (
    <div
      className="ds-v2"
      style={{
        position: 'fixed',
        bottom: 'var(--s4)',
        right: 'var(--s4)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--s2)',
        zIndex: 1000,
        pointerEvents: 'none',
      }}
    >
      {list.map((e) => (
        <ToastCard key={e.id} entry={e} />
      ))}
    </div>
  );
}

function ToastCard({ entry }: { entry: ToastEntry }) {
  return (
    <div
      className={`toast toast--${entry.tone}`}
      role="status"
      aria-live="polite"
      style={{ pointerEvents: 'auto' }}
    >
      <div className="toast__rule" aria-hidden />
      <div className="toast__body">
        <div className="toast__title">{entry.title}</div>
        {entry.body && <div className="toast__sub">{entry.body}</div>}
      </div>
      {entry.action && (
        <button
          className="toast__action"
          onClick={() => { entry.action!.onClick(); toast.dismiss(entry.id); }}
        >
          {entry.action.label}
        </button>
      )}
      <button
        className="toast__dismiss"
        onClick={() => toast.dismiss(entry.id)}
        aria-label="dismiss"
      >×</button>
    </div>
  );
}
