/* Shortcut sheet — a floating cheat sheet of every keyboard binding.
 * Triggered by `?` from anywhere; dismissed by Esc or click-outside.
 *
 * The shortcut registry is the source of truth — Shell doesn't duplicate it.
 */

import { useEffect, useState } from 'react';
import { Kbd } from '@/components/ui';
import { X } from '@phosphor-icons/react';

type Shortcut = { keys: string[]; label: string; detail?: string };
type Group = { title: string; items: Shortcut[] };

const GROUPS: Group[] = [
  {
    title: 'Counter',
    items: [
      { keys: ['F2'],  label: 'Sale',          detail: 'open the counter' },
      { keys: ['F9'],  label: 'Weigh & print', detail: 'post the current sale' },
      { keys: ['F3'],  label: 'Purchase',      detail: 'record incoming goods' },
      { keys: ['F8'],  label: 'Karigar',       detail: 'workshop issue/receive' },
    ],
  },
  {
    title: 'Books',
    items: [
      { keys: ['F5'],  label: 'Ledgers',  detail: 'cash · metal · party' },
      { keys: ['F6'],  label: 'Parties',  detail: 'customer directory' },
      { keys: ['F7'],  label: 'Items',    detail: 'the case' },
      { keys: ['F4'],  label: 'Stock',    detail: 'register + adjustments' },
      { keys: ['F12'], label: 'Reports',  detail: 'GST + registers' },
    ],
  },
  {
    title: 'Universal',
    items: [
      { keys: ['Ctrl', 'Space'], label: 'Ring the Bell', detail: 'glance + jump' },
      { keys: ['/'],             label: 'Search',        detail: 'focus the top search bar' },
      { keys: ['?'],             label: 'This sheet',    detail: 'show all shortcuts' },
      { keys: ['F10'],           label: 'Seal the day',  detail: 'snapshot the ledger' },
      { keys: ['F11'],           label: 'Dev',           detail: 'smoke test runner' },
      { keys: ['Esc'],           label: 'Dismiss',       detail: 'close overlay / toast' },
    ],
  },
];

export function ShortcutSheet() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Open on `?` — but only when nothing is focused and no modifier is held,
      // so we don't fight real text input.
      const tag = (document.activeElement?.tagName ?? '').toUpperCase();
      const inField = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
      if (e.key === '?' && !inField && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === 'Escape' && open) {
        e.preventDefault();
        setOpen(false);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="ds-v2"
      role="dialog"
      aria-label="Keyboard shortcuts"
      onClick={() => setOpen(false)}
      style={{
        position: 'fixed', inset: 0,
        background: 'var(--scrim)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: 'min(10vh, 80px)',
        zIndex: 500,
        animation: 'ds-screen-enter 180ms cubic-bezier(0.20, 0, 0, 1)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(720px, 92vw)',
          background: 'var(--surface)',
          border: '1px solid var(--border-strong)',
          borderRadius: 'var(--radius-2)',
          padding: 'var(--s5)',
          display: 'flex', flexDirection: 'column', gap: 'var(--s4)',
          maxHeight: '80vh', overflow: 'auto',
        }}
      >
        <header style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          paddingBottom: 'var(--s3)',
          borderBottom: '1px solid var(--border)',
        }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--s3)' }}>
            <div style={{ fontSize: 'var(--t-lg)', fontWeight: 600 }}>Shortcuts</div>
            <div style={{ fontSize: 'var(--t-sm)', color: 'var(--text-mute)' }}>
              every binding in the app
            </div>
          </div>
          <button
            onClick={() => setOpen(false)}
            aria-label="close"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-mute)', padding: 4,
            }}
          ><X size={14} /></button>
        </header>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 'var(--s5)',
        }}>
          {GROUPS.map((g) => (
            <section key={g.title}>
              <div style={{
                fontSize: 'var(--t-sm)', color: 'var(--text-mute)',
                textTransform: 'uppercase', letterSpacing: '0.08em',
                marginBottom: 'var(--s2)',
              }}>{g.title}</div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {g.items.map((s, i) => (
                  <ShortcutRow key={i} s={s} />
                ))}
              </div>
            </section>
          ))}
        </div>

        <footer style={{
          paddingTop: 'var(--s3)',
          borderTop: '1px solid var(--border)',
          fontSize: 'var(--t-xs)', color: 'var(--text-faint)',
          display: 'flex', justifyContent: 'space-between',
        }}>
          <span>Press <Kbd>?</Kbd> any time to toggle this sheet.</span>
          <span><Kbd>Esc</Kbd> to close</span>
        </footer>
      </div>
    </div>
  );
}

function ShortcutRow({ s }: { s: Shortcut }) {
  return (
    <div className="row" style={{
      minHeight: 36,
      padding: 'var(--s2) var(--s3)',
      border: 'none',
      borderBottom: '1px solid var(--border)',
    }}>
      <div style={{ display: 'inline-flex', gap: 4, width: 110, flexShrink: 0 }}>
        {s.keys.map((k, i) => (
          <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
            <Kbd>{k}</Kbd>
            {i < s.keys.length - 1 && <span style={{ color: 'var(--text-faint)', fontSize: 10 }}>+</span>}
          </span>
        ))}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 'var(--t-base)' }}>{s.label}</div>
        {s.detail && (
          <div style={{ fontSize: 'var(--t-xs)', color: 'var(--text-mute)' }}>{s.detail}</div>
        )}
      </div>
    </div>
  );
}
