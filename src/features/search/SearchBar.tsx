import { useEffect, useRef, useState } from 'react';
import { CH, invoke } from '@/lib/ipc';
import type { SearchHit } from '@shared/ipc';

// ponytail: debounce with a bare setTimeout. No lodash.
export function SearchBar({ onPick }: { onPick?: (hit: SearchHit) => void }) {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
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

  // close on outside click
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  return (
    <div ref={ref} className="relative w-72">
      <input
        className="input w-full"
        placeholder="search items / parties…  (/)"
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
      />
      {open && q.trim() && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-border rounded shadow-lg max-h-80 overflow-auto z-10">
          {loading && <div className="px-3 py-2 text-xs text-muted">searching…</div>}
          {err && <div className="px-3 py-2 text-xs text-danger">{err}</div>}
          {!loading && !err && hits.length === 0 && <div className="px-3 py-2 text-xs text-muted">no matches</div>}
          {hits.map((h) => (
            <button
              key={`${h.kind}-${h.id}`}
              className="w-full text-left px-3 py-1.5 text-sm hover:bg-[var(--bg-hover)] border-b border-border/40 last:border-0"
              onClick={() => { onPick?.(h); setOpen(false); setQ(''); }}
            >
              <div className="flex justify-between gap-2">
                <span>{h.name}</span>
                <span className="text-xs text-muted mono">{h.kind}</span>
              </div>
              <div className="text-xs text-muted mono">
                {h.kind === 'item' ? `${h.sku} · ${h.category}${h.stamp ? ` · ${h.stamp}` : ''}` : `${h.role}${h.phone ? ` · ${h.phone}` : ''}`}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
