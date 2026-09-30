import { useEffect, useState } from 'react';
import { Plus, Printer, X, ImageSquare } from '@phosphor-icons/react';
import { CH, invoke } from '@/lib/ipc';
import { useAsync, useMutation } from '@/lib/useAsync';
import { fmtGrams, fmtCarat } from '@/lib/format';
import { ErrorBanner, LoadingBlock, EmptyState, Spinner } from '@/components/Status';
import { CategoryBadge } from '@/components/CategoryBadge';

type GridRow = {
  id: number; sku: string; name: string;
  category: 'gold' | 'silver' | 'stone' | 'artificial';
  stamp: string | null; unit: 'gms' | 'carat' | 'pcs';
  tags: string; stockQty: number; stockWtMg: number;
  primaryPhoto: string | null; photoCount: number;
  collectionNames: string | null;
};

type Collection = { id: number; name: string; description: string; itemCount: number };

export function CatalogScreen() {
  const [q, setQ] = useState('');
  const [collectionId, setCollectionId] = useState<number | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [detailId, setDetailId] = useState<number | null>(null);

  const collections = useAsync<Collection[]>(() => invoke(CH.collectionsList));
  const grid = useAsync<GridRow[]>(
    () => invoke(CH.catalogGrid, { q: q || undefined, collectionId: collectionId ?? undefined }),
    [q, collectionId],
  );

  const printMut = useMutation<any, any>((p) => invoke(CH.labelsPrint, p));
  const [copies, setCopies] = useState(1);

  function toggleSel(id: number) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  async function printSelected() {
    if (selected.size === 0) return;
    try {
      await printMut.run({ itemIds: Array.from(selected), copies });
      setSelected(new Set());
    } catch { /* surfaced */ }
  }

  return (
    <div className="max-w-6xl space-y-4">
      {/* toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <input
          className="input flex-1 min-w-[220px]"
          placeholder="search name, SKU, or tag…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          className="input"
          value={collectionId ?? ''}
          onChange={(e) => setCollectionId(e.target.value === '' ? null : Number(e.target.value))}
        >
          <option value="">all collections</option>
          {(collections.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>{c.name} ({c.itemCount})</option>
          ))}
        </select>
        <CollectionsButton onSaved={() => collections.reload()} />

        <div className="flex-1" />

        {selected.size > 0 && (
          <>
            <label className="text-[11px] text-[var(--ink-500)] mono uppercase tracking-wider">
              copies
              <input
                type="number" min={1} max={50} value={copies}
                onChange={(e) => setCopies(Math.max(1, Number(e.target.value) || 1))}
                className="input mono ml-2" style={{ width: 60 }}
              />
            </label>
            <button className="btn-primary" onClick={printSelected} disabled={printMut.loading}>
              {printMut.loading ? <Spinner label="printing" /> : (
                <><Printer size={12} weight="bold" /> Print {selected.size} label{selected.size > 1 ? 's' : ''}</>
              )}
            </button>
            <button className="btn-ghost" onClick={() => setSelected(new Set())} aria-label="clear">
              <X size={12} />
            </button>
          </>
        )}
      </div>

      {printMut.error && <ErrorBanner message={printMut.error} onDismiss={printMut.clearError} />}
      {grid.error && <ErrorBanner message={grid.error} onDismiss={() => grid.reload()} />}

      {/* grid */}
      {grid.loading ? <LoadingBlock label="loading catalog…" /> : (grid.data?.length ?? 0) === 0 ? (
        <EmptyState hint={q || collectionId ? 'no items match the filter' : 'add items and photos to build your catalog'}>
          empty catalog
        </EmptyState>
      ) : (
        <div
          className="grid gap-3"
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}
        >
          {(grid.data ?? []).map((it) => (
            <CatalogCard
              key={it.id}
              row={it}
              selected={selected.has(it.id)}
              onToggle={() => toggleSel(it.id)}
              onOpen={() => setDetailId(it.id)}
            />
          ))}
        </div>
      )}

      {detailId && (
        <ItemDetailModal
          itemId={detailId}
          onClose={() => { setDetailId(null); grid.reload(); }}
          collections={collections.data ?? []}
        />
      )}
    </div>
  );
}

function CatalogCard({ row, selected, onToggle, onOpen }: {
  row: GridRow; selected: boolean; onToggle: () => void; onOpen: () => void;
}) {
  return (
    <div
      className="card"
      style={{
        padding: 0,
        overflow: 'hidden',
        cursor: 'pointer',
        borderColor: selected ? 'var(--gold-500)' : 'var(--rule)',
        boxShadow: selected ? 'inset 0 0 0 1px var(--gold-500)' : 'none',
      }}
      onClick={onOpen}
    >
      <div
        style={{
          position: 'relative',
          aspectRatio: '1 / 1',
          background: 'var(--paper-3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        {row.primaryPhoto ? (
          <img
            src={`photo://${row.primaryPhoto}`}
            alt={row.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <ImageSquare size={40} weight="thin" color="var(--ink-300)" />
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
          className="mono"
          style={{
            position: 'absolute', top: 6, left: 6,
            width: 20, height: 20, borderRadius: 3,
            border: '1px solid ' + (selected ? 'var(--gold-500)' : 'var(--rule-ink)'),
            background: selected ? 'var(--gold-500)' : 'rgba(255,255,255,0.85)',
            color: selected ? 'var(--paper)' : 'var(--ink-500)',
            fontSize: 12, lineHeight: 1, cursor: 'pointer',
          }}
          aria-label="select for label print"
        >
          {selected ? '✓' : ''}
        </button>
        {row.photoCount > 1 && (
          <span className="mono" style={{
            position: 'absolute', bottom: 6, right: 6,
            background: 'rgba(20,16,14,0.75)', color: 'var(--paper)',
            padding: '1px 6px', borderRadius: 2, fontSize: 10,
          }}>{row.photoCount} photos</span>
        )}
      </div>
      <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ fontWeight: 500, fontSize: 13 }} className="truncate">{row.name}</div>
        <div className="mono text-[11px] text-[var(--ink-500)]">{row.sku}</div>
        <div className="flex items-center gap-1 flex-wrap">
          <CategoryBadge category={row.category} stamp={row.stamp} />
        </div>
        <div className="text-[11px] text-[var(--ink-500)] mono">
          {row.unit === 'pcs' ? `${row.stockQty} pcs` : row.unit === 'carat' ? fmtCarat(row.stockWtMg) : fmtGrams(row.stockWtMg)}
        </div>
        {row.collectionNames && (
          <div className="text-[10px] text-[var(--ink-500)] italic truncate">{row.collectionNames}</div>
        )}
      </div>
    </div>
  );
}

function CollectionsButton({ onSaved }: { onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const list = useAsync<Collection[]>(() => invoke(CH.collectionsList), [open]);
  const create = useMutation<any, any>((p) => invoke(CH.collectionsCreate, p));
  const del = useMutation<number, any>((id) => invoke(CH.collectionsDelete, { id }));

  async function add() {
    if (!name.trim()) return;
    try { await create.run({ name, description: '' }); setName(''); await list.reload(); onSaved(); } catch { /* surfaced */ }
  }
  async function remove(id: number) {
    if (!confirm('Delete this collection? Item memberships will be removed too.')) return;
    try { await del.run(id); await list.reload(); onSaved(); } catch { /* surfaced */ }
  }

  return (
    <>
      <button className="btn" onClick={() => setOpen(true)}>
        <Plus size={12} weight="bold" /> Collections
      </button>
      {open && (
        <Modal title="Collections" onClose={() => setOpen(false)}>
          <div className="flex gap-2 mb-3">
            <input className="input flex-1" placeholder="new collection name" value={name} onChange={(e) => setName(e.target.value)}
                   onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} />
            <button className="btn-primary" onClick={add} disabled={create.loading}>
              {create.loading ? <Spinner /> : 'Add'}
            </button>
          </div>
          {create.error && <ErrorBanner message={create.error} onDismiss={create.clearError} />}
          {del.error && <ErrorBanner message={del.error} onDismiss={del.clearError} />}
          {list.loading ? <LoadingBlock /> : (
            <table className="ledger-table">
              <thead><tr><th>Name</th><th className="text-right">Items</th><th></th></tr></thead>
              <tbody>
                {(list.data ?? []).map((c) => (
                  <tr key={c.id}>
                    <td>{c.name}</td>
                    <td className="num">{c.itemCount}</td>
                    <td className="text-right">
                      <button className="link text-danger" onClick={() => remove(c.id)}>delete</button>
                    </td>
                  </tr>
                ))}
                {(list.data?.length ?? 0) === 0 && <tr><td colSpan={3}><EmptyState>no collections yet</EmptyState></td></tr>}
              </tbody>
            </table>
          )}
        </Modal>
      )}
    </>
  );
}

function ItemDetailModal({ itemId, onClose, collections }: {
  itemId: number; onClose: () => void; collections: Collection[];
}) {
  const photos = useAsync<any[]>(() => invoke(CH.photosList, { itemId }), [itemId]);
  const itemCols = useAsync<{ id: number; name: string }[]>(() => invoke(CH.itemCollectionsGet, { itemId }), [itemId]);
  const items = useAsync<any[]>(() => invoke(CH.itemsList));
  const item = (items.data ?? []).find((i) => i.id === itemId);

  const addPhoto = useMutation<any, any>((p) => invoke(CH.photosAdd, p));
  const delPhoto = useMutation<number, any>((id) => invoke(CH.photosDelete, { id }));
  const setPrim = useMutation<number, any>((id) => invoke(CH.photosSetPrimary, { id }));
  const setTags = useMutation<any, any>((p) => invoke(CH.itemTagsSet, p));
  const setCols = useMutation<any, any>((p) => invoke(CH.itemCollectionsSet, p));

  const [tags, setTagsState] = useState<string>('');
  const [cols, setColsState] = useState<Set<number>>(new Set());

  useEffect(() => { if (item?.tags !== undefined) setTagsState(item.tags); }, [item?.tags]);
  useEffect(() => { setColsState(new Set((itemCols.data ?? []).map((c) => c.id))); }, [itemCols.data]);

  async function onAdd() {
    try { await addPhoto.run({ itemId }); await photos.reload(); } catch { /* surfaced */ }
  }
  async function onDel(id: number) {
    if (!confirm('Delete this photo?')) return;
    try { await delPhoto.run(id); await photos.reload(); } catch { /* surfaced */ }
  }
  async function onSetPrim(id: number) {
    try { await setPrim.run(id); await photos.reload(); } catch { /* surfaced */ }
  }
  async function saveMeta() {
    try {
      await setTags.run({ itemId, tags });
      await setCols.run({ itemId, collectionIds: Array.from(cols) });
      onClose();
    } catch { /* surfaced */ }
  }

  return (
    <Modal title={item?.name ?? 'Item'} onClose={onClose} wide>
      {items.loading || !item ? <LoadingBlock /> : (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <CategoryBadge category={item.category} stamp={item.stamp} size="md" />
            <span className="mono text-xs text-[var(--ink-500)]">{item.sku}</span>
            <span className="text-xs text-[var(--ink-500)]">
              {item.unit === 'pcs' ? `${item.stockQty} pcs` : item.unit === 'carat' ? fmtCarat(item.stockWtMg) : fmtGrams(item.stockWtMg)}
            </span>
          </div>

          <div>
            <div className="section-label mb-2">— photos ————————</div>
            {photos.loading ? <LoadingBlock /> : (
              <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))' }}>
                {(photos.data ?? []).map((p) => (
                  <div key={p.id} className="card" style={{ padding: 0, overflow: 'hidden', position: 'relative' }}>
                    <div style={{ aspectRatio: '1 / 1', background: 'var(--paper-3)' }}>
                      <img src={`photo://${p.filename}`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                    <div className="flex items-center justify-between px-2 py-1 border-t border-[var(--rule)]">
                      {p.position === 0 ? (
                        <span className="text-[10px] mono uppercase tracking-wider text-[var(--gold-700)]">primary</span>
                      ) : (
                        <button className="link text-[10px]" onClick={() => onSetPrim(p.id)}>make primary</button>
                      )}
                      <button className="link text-danger text-[10px]" onClick={() => onDel(p.id)}>delete</button>
                    </div>
                  </div>
                ))}
                <button
                  className="card flex items-center justify-center"
                  style={{ aspectRatio: '1 / 1', padding: 0, cursor: 'pointer', flexDirection: 'column', gap: 6 }}
                  onClick={onAdd}
                  disabled={addPhoto.loading}
                >
                  {addPhoto.loading
                    ? <Spinner label="uploading" />
                    : <><Plus size={22} weight="regular" color="var(--ink-500)" />
                        <span className="text-[11px] text-[var(--ink-500)]">add photo</span></>}
                </button>
              </div>
            )}
            {addPhoto.error && <ErrorBanner message={addPhoto.error} onDismiss={addPhoto.clearError} />}
            {delPhoto.error && <ErrorBanner message={delPhoto.error} onDismiss={delPhoto.clearError} />}
          </div>

          <div>
            <div className="section-label mb-2">— tags ————————————</div>
            <input
              className="input w-full"
              placeholder="ring, wedding, bridal, floral (comma-separated)"
              value={tags}
              onChange={(e) => setTagsState(e.target.value)}
            />
          </div>

          <div>
            <div className="section-label mb-2">— collections ———————</div>
            <div className="flex flex-wrap gap-2">
              {collections.length === 0 && (
                <span className="text-xs text-[var(--ink-500)]">
                  No collections yet — close and click "Collections" to create some.
                </span>
              )}
              {collections.map((c) => {
                const on = cols.has(c.id);
                return (
                  <button
                    key={c.id}
                    onClick={() => {
                      const n = new Set(cols);
                      if (on) n.delete(c.id); else n.add(c.id);
                      setColsState(n);
                    }}
                    className="mono"
                    style={{
                      padding: '3px 10px', borderRadius: 3,
                      border: '1px solid ' + (on ? 'var(--gold-500)' : 'var(--rule)'),
                      background: on ? 'rgba(184,137,46,0.12)' : 'transparent',
                      color: on ? 'var(--gold-700)' : 'var(--ink-700)',
                      fontSize: 11, cursor: 'pointer',
                    }}
                  >
                    {c.name}
                  </button>
                );
              })}
            </div>
          </div>

          {setTags.error && <ErrorBanner message={setTags.error} onDismiss={setTags.clearError} />}
          {setCols.error && <ErrorBanner message={setCols.error} onDismiss={setCols.clearError} />}

          <div className="flex gap-2">
            <button className="btn-primary" onClick={saveMeta} disabled={setTags.loading || setCols.loading}>
              {setTags.loading || setCols.loading ? <Spinner label="saving" /> : 'Save & close'}
            </button>
            <button className="btn" onClick={onClose}>Close without saving</button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function Modal({ title, onClose, wide, children }: {
  title: string; onClose: () => void; wide?: boolean; children: React.ReactNode;
}) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(20,16,14,0.4)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: 60, zIndex: 100,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="card"
        style={{ maxWidth: wide ? 820 : 520, width: '95%', maxHeight: '85vh', overflow: 'auto' }}
      >
        <div className="flex items-center justify-between mb-3">
          <span className="screen-title" style={{ fontSize: 20 }}>{title}</span>
          <button onClick={onClose} className="btn-ghost" style={{ padding: 4, height: 24 }} aria-label="close">
            <X size={12} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
