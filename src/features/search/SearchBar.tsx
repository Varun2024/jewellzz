/* Top-strip search — items + parties. Ported to v2 primitives. */

import { useEffect, useRef, useState } from 'react';
import { CH, invoke } from '@/lib/ipc';
import type { SearchHit } from '@shared/ipc';

export function SearchBar({ onPick }: { onPick?: (hit: SearchHit) => void }) {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!q.trim()) { setHits([]); setErr(null); return; }
    const t = setTimeout(async () => {
      setLoading(true); setErr(null);
      try {
        const r = await invoke<SearchHit[]>(CH.search, { q, scope: 'all', limit: 20 });
        setHits(r);
      } catch (e: any) {
        setErr(e?.message ?? 'search failed');
        setHits([]);
      } finally {
        setLoading(false);
      }
    }, 120);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  return (
    <div ref={ref} className="ds-v2" style={{ position: 'relative', width: 288 }}>
      <input
        className="input"
        style={{ width: '100%' }}
        placeholder="search items / parties…  (/)"
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
      />
      {open && q.trim() && (
        <div
          className="menu"
          style={{ maxHeight: 320 }}
        >
          {loading && (
            <div style={{
              padding: '8px 12px',
              fontSize: 'var(--t-sm)',
              color: 'var(--text-mute)',
            }}>searching…</div>
          )}
          {err && (
            <div style={{
              padding: '8px 12px',
              fontSize: 'var(--t-sm)',
              color: 'var(--neg)',
            }}>{err}</div>
          )}
          {!loading && !err && hits.length === 0 && (
            <div style={{
              padding: '8px 12px',
              fontSize: 'var(--t-sm)',
              color: 'var(--text-mute)',
            }}>no matches</div>
          )}
          {hits.map((h) => (
            <button
              key={`${h.kind}-${h.id}`}
              className="menu__item"
              onClick={() => { onPick?.(h); setOpen(false); setQ(''); }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span>{h.name}</span>
                <span style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 'var(--t-sm)',
                  color: 'var(--text-mute)',
                }}>{h.kind}</span>
              </div>
              <div className="menu__item__meta">
                {h.kind === 'item'
                  ? `${h.sku} · ${h.category}${h.stamp ? ` · ${h.stamp}` : ''}`
                  : `${h.role}${h.phone ? ` · ${h.phone}` : ''}`}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
