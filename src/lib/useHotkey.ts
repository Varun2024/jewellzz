/* useHotkey — small helper for screen-level keyboard shortcuts.
 *
 * Fires `handler` when `key` is pressed, as long as no editable element
 * (input/textarea/select/contenteditable) currently holds focus and no
 * modifier key (Ctrl/Meta/Alt) is held. Shift is tolerated — pressing `?`
 * uses it.
 *
 * `enabled` lets a screen gate the shortcut by UI state (e.g. only bind
 * `Esc` when a form is open).
 */

import { useEffect } from 'react';

export function useHotkey(
  key: string,
  handler: (e: KeyboardEvent) => void,
  enabled = true,
): void {
  useEffect(() => {
    if (!enabled) return;
    function onKey(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const el = document.activeElement as HTMLElement | null;
      const tag = el?.tagName.toUpperCase() ?? '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (el?.isContentEditable) return;
      if (e.key.toLowerCase() !== key.toLowerCase()) return;
      e.preventDefault();
      handler(e);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [key, handler, enabled]);
}
