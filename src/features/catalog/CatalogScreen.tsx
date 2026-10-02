/* Catalog — photo grid, collections, labels. Ported to v2 primitives. */

import { useEffect, useState } from 'react';
import { Plus, Printer, X, ImageSquare } from '@phosphor-icons/react';
import { CH, invoke } from '@/lib/ipc';
import { useAsync, useMutation } from '@/lib/useAsync';
import { CategoryBadge } from '@/components/CategoryBadge';
import {
  Button, Field, Weight, Num, Progress, Empty,
} from '@/components/ui';

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
    <div className="ds-v2" style={{ padding: 'var(--container-pad)', height: '100%', overflow: 'auto', boxSizing: 'border-box' }}>
      <div style={{ maxWidth: 1200, display: 'flex', flexDirection: 'column', gap: 'var(--s4)' }}>

        {/* toolbar */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 'var(--s2)', flexWrap: 'wrap',
          padding: 'var(--s3)',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-1)',
        }}>
          <input
            className="input"
            style={{ flex: 1, minWidth: 220 }}
            placeholder="search name, SKU, or tag…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select
            className="input"
            value={collectionId ?? ''}
            onChange={(e) => setCollectionId(e.target.value === '' ? null : Number(e.target.value))}
            style={{ width: 220 }}
          >
            <option value="">all collections</option>
            {(collections.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>{c.name} ({c.itemCount})</option>
            ))}
          </select>
          <CollectionsButton onSaved={() => collections.reload()} />

          {selected.size > 0 && (
            <>
              <div style={{ flex: 1 }} />
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span style={{
                  fontSize: 'var(--t-xs)', color: 'var(--text-mute)',
                  textTransform: 'uppercase', letterSpacing: '0.08em',
                }}>copies</span>
                <input
                  type="number" min={1} max={50} value={copies}
                  onChange={(e) => setCopies(Math.max(1, Number(e.target.value) || 1))}
                  className="input input--num" style={{ width: 60 }}
                />
              </div>
              <Button variant="primary" onClick={printSelected} disabled={printMut.loading} leading={<Printer size={12} weight="bold" />}>
                {printMut.loading ? 'Printing…' : `Print ${selected.size} label${selected.size > 1 ? 's' : ''}`}
              </Button>
              <button
                onClick={() => setSelected(new Set())}
                aria-label="clear selection"
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text-mute)', padding: 4,
                }}
              ><X size={12} /></button>
            </>
          )}
        </div>

        {printMut.error && <InlineAlert message={printMut.error} onDismiss={printMut.clearError} />}
        {grid.error && <InlineAlert message={grid.error} onDismiss={() => grid.reload()} />}

        {/* grid */}
        {grid.loading ? <Progress /> : (grid.data?.length ?? 0) === 0 ? (
          <Empty mark="case" title={q || collectionId ? 'No items match the filter' : 'Empty catalog'}>
            {q || collectionId
              ? 'Try a different search or collection.'
              : 'Add items and photos to build your catalog.'}
          </Empty>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
              gap: 'var(--s3)',
            }}
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
    </div>
  );
}

/* ---------------------------- Card ---------------------------- */

function CatalogCard({ row, selected, onToggle, onOpen }: {
  row: GridRow; selected: boolean; onToggle: () => void; onOpen: () => void;
}) {
  return (
    <div
      onClick={onOpen}
      style={{
        background: 'var(--surface)',
        border: `1px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius: 'var(--radius-2)',
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'border-color var(--motion-quick) var(--ease-out)',
      }}
    >
      <div style={{
        position: 'relative',
        aspectRatio: '1 / 1',
        background: 'var(--surface-hi)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {row.primaryPhoto ? (
          <img
            src={`photo://${row.primaryPhoto}`}
            alt={row.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <ImageSquare size={40} weight="thin" color="var(--border-strong)" />
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
          aria-label="select for label print"
          style={{
            position: 'absolute', top: 6, left: 6,
            width: 20, height: 20, borderRadius: 3,
            border: '1px solid ' + (selected ? 'var(--accent)' : 'var(--border-strong)'),
            background: selected ? 'var(--accent)' : 'rgba(255,255,255,0.85)',
            color: selected ? 'var(--accent-fg)' : 'var(--text-mute)',
            fontFamily: 'var(--font-mono)',
            fontSize: 12, lineHeight: 1, cursor: 'pointer',
          }}
        >
          {selected ? '✓' : ''}
        </button>
        {row.photoCount > 1 && (
          <span style={{
            position: 'absolute', bottom: 6, right: 6,
            background: 'rgba(20,18,16,0.75)', color: '#FFFDF7',
            padding: '1px 6px', borderRadius: 2,
            fontFamily: 'var(--font-mono)', fontSize: 10,
          }}>{row.photoCount} photos</span>
        )}
      </div>
      <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{
          fontWeight: 500, fontSize: 'var(--t-base)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{row.name}</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-xs)', color: 'var(--text-mute)' }}>{row.sku}</div>
        <div><CategoryBadge category={row.category} stamp={row.stamp} /></div>
        <div style={{ fontSize: 'var(--t-xs)', color: 'var(--text-mute)', fontFamily: 'var(--font-mono)' }}>
          {row.unit === 'pcs'
            ? <><Num value={row.stockQty} /> pcs</>
            : <Weight mg={row.stockWtMg} unit={row.unit === 'carat' ? 'ct' : 'g'} />}
        </div>
        {row.collectionNames && (
          <div style={{
            fontSize: 10, color: 'var(--text-mute)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{row.collectionNames}</div>
        )}
      </div>
    </div>
  );
}

/* ---------------------- Collections dialog -------------------- */

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
      <Button onClick={() => setOpen(true)} leading={<Plus size={12} weight="bold" />}>
        Collections
      </Button>
      {open && (
        <Modal title="Collections" onClose={() => setOpen(false)}>
          <div style={{ display: 'flex', gap: 'var(--s2)', marginBottom: 'var(--s3)' }}>
            <input
              className="input"
              style={{ flex: 1 }}
              placeholder="new collection name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
            />
            <Button variant="primary" onClick={add} disabled={create.loading}>
              {create.loading ? 'Adding…' : 'Add'}
            </Button>
          </div>
          {create.error && <InlineAlert message={create.error} onDismiss={create.clearError} />}
          {del.error    && <InlineAlert message={del.error}    onDismiss={del.clearError} />}
          {list.loading ? <Progress /> : (
            <table className="table">
              <thead><tr><th>Name</th><th className="num" style={{ width: 70 }}>Items</th><th style={{ width: 80 }} /></tr></thead>
              <tbody>
                {(list.data ?? []).map((c) => (
                  <tr key={c.id}>
                    <td>{c.name}</td>
                    <td className="num"><Num value={c.itemCount} /></td>
                    <td className="num">
                      <Button variant="link" onClick={() => remove(c.id)} style={{ color: 'var(--neg)' }}>delete</Button>
                    </td>
                  </tr>
                ))}
                {(list.data?.length ?? 0) === 0 && (
                  <tr><td colSpan={3} style={{ padding: 'var(--s4)' }}><Empty title="No collections yet" /></td></tr>
                )}
              </tbody>
            </table>
          )}
        </Modal>
      )}
    </>
  );
}

/* ---------------------- Item detail modal --------------------- */

function ItemDetailModal({ itemId, onClose, collections }: {
  itemId: number; onClose: () => void; collections: Collection[];
}) {
  const photos = useAsync<any[]>(() => invoke(CH.photosList, { itemId }), [itemId]);
  const itemCols = useAsync<{ id: number; name: string }[]>(() => invoke(CH.itemCollectionsGet, { itemId }), [itemId]);
  const items = useAsync<any[]>(() => invoke(CH.itemsList));
  const item = (items.data ?? []).find((i) => i.id === itemId);

  const addPhoto = useMutation<any, any>((p) => invoke(CH.photosAdd, p));
  const delPhoto = useMutation<number, any>((id) => invoke(CH.photosDelete, { id }));
  const setPrim  = useMutation<number, any>((id) => invoke(CH.photosSetPrimary, { id }));
  const setTags  = useMutation<any, any>((p) => invoke(CH.itemTagsSet, p));
  const setCols  = useMutation<any, any>((p) => invoke(CH.itemCollectionsSet, p));

  const [tags, setTagsState] = useState<string>('');
  const [cols, setColsState] = useState<Set<number>>(new Set());

  useEffect(() => { if (item?.tags !== undefined) setTagsState(item.tags); }, [item?.tags]);
  useEffect(() => { setColsState(new Set((itemCols.data ?? []).map((c) => c.id))); }, [itemCols.data]);

  async function onAdd()        { try { await addPhoto.run({ itemId }); await photos.reload(); } catch { /* surfaced */ } }
  async function onDel(id: number) {
    if (!confirm('Delete this photo?')) return;
    try { await delPhoto.run(id); await photos.reload(); } catch { /* surfaced */ }
  }
  async function onSetPrim(id: number) { try { await setPrim.run(id); await photos.reload(); } catch { /* surfaced */ } }
  async function saveMeta() {
    try {
      await setTags.run({ itemId, tags });
      await setCols.run({ itemId, collectionIds: Array.from(cols) });
      onClose();
    } catch { /* surfaced */ }
  }

  return (
    <Modal title={item?.name ?? 'Item'} onClose={onClose} wide>
      {items.loading || !item ? <Progress /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s3)' }}>
            <CategoryBadge category={item.category} stamp={item.stamp} size="md" />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-sm)', color: 'var(--text-mute)' }}>{item.sku}</span>
            <span style={{ fontSize: 'var(--t-sm)' }}>
              {item.unit === 'pcs'
                ? <><Num value={item.stockQty} /> pcs</>
                : <Weight mg={item.stockWtMg} unit={item.unit === 'carat' ? 'ct' : 'g'} />}
            </span>
          </div>

          <div>
            <SectionLabel>Photos</SectionLabel>
            {photos.loading ? <Progress /> : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
                gap: 'var(--s2)',
              }}>
                {(photos.data ?? []).map((p) => (
                  <div key={p.id} style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-1)',
                    overflow: 'hidden',
                  }}>
                    <div style={{ aspectRatio: '1 / 1', background: 'var(--surface-hi)' }}>
                      <img src={`photo://${p.filename}`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '4px 8px', borderTop: '1px solid var(--border)',
                      fontSize: 10,
                    }}>
                      {p.position === 0 ? (
                        <span style={{
                          fontFamily: 'var(--font-mono)', color: 'var(--accent-press)',
                          textTransform: 'uppercase', letterSpacing: '0.08em',
                        }}>primary</span>
                      ) : (
                        <Button variant="link" onClick={() => onSetPrim(p.id)} style={{ fontSize: 10 }}>make primary</Button>
                      )}
                      <Button variant="link" onClick={() => onDel(p.id)} style={{ fontSize: 10, color: 'var(--neg)' }}>delete</Button>
                    </div>
                  </div>
                ))}
                <button
                  onClick={onAdd}
                  disabled={addPhoto.loading}
                  style={{
                    background: 'var(--surface)',
                    border: '1px dashed var(--border-strong)',
                    borderRadius: 'var(--radius-1)',
                    aspectRatio: '1 / 1',
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    gap: 6, cursor: 'pointer',
                    color: 'var(--text-mute)', fontSize: 'var(--t-xs)',
                  }}
                >
                  {addPhoto.loading
                    ? 'Uploading…'
                    : <><Plus size={22} weight="regular" /><span>add photo</span></>}
                </button>
              </div>
            )}
            {addPhoto.error && <InlineAlert message={addPhoto.error} onDismiss={addPhoto.clearError} />}
            {delPhoto.error && <InlineAlert message={delPhoto.error} onDismiss={delPhoto.clearError} />}
          </div>

          <div>
            <SectionLabel>Tags</SectionLabel>
            <Field
              label=""
              placeholder="ring, wedding, bridal, floral (comma-separated)"
              value={tags}
              onChange={(e) => setTagsState(e.target.value)}
            />
          </div>

          <div>
            <SectionLabel>Collections</SectionLabel>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--s2)' }}>
              {collections.length === 0 && (
                <span style={{ fontSize: 'var(--t-sm)', color: 'var(--text-mute)' }}>
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
                    style={{
                      padding: '3px 10px',
                      borderRadius: 10,
                      border: '1px solid ' + (on ? 'var(--accent)' : 'var(--border)'),
                      background: on ? 'color-mix(in oklab, var(--gold-500) 12%, transparent)' : 'transparent',
                      color: on ? 'var(--accent-press)' : 'var(--text-mute)',
                      fontSize: 'var(--t-sm)',
                      cursor: 'pointer',
                    }}
                  >
                    {c.name}
                  </button>
                );
              })}
            </div>
          </div>

          {setTags.error && <InlineAlert message={setTags.error} onDismiss={setTags.clearError} />}
          {setCols.error && <InlineAlert message={setCols.error} onDismiss={setCols.clearError} />}

          <div style={{ display: 'flex', gap: 'var(--s2)' }}>
            <Button variant="primary" onClick={saveMeta} disabled={setTags.loading || setCols.loading}>
              {setTags.loading || setCols.loading ? 'Saving…' : 'Save & close'}
            </Button>
            <Button onClick={onClose}>Close without saving</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

/* ------------------------- small bits ------------------------- */

function Modal({ title, onClose, wide, children }: {
  title: string; onClose: () => void; wide?: boolean; children: React.ReactNode;
}) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'var(--scrim)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: 60, zIndex: 100,
      }}
    >
      <div
        className="ds-v2"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: wide ? 820 : 520, width: '95%', maxHeight: '85vh', overflow: 'auto',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-2)',
          padding: 'var(--s4)',
          outline: '2px solid var(--focus-ring)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--s3)' }}>
          <span style={{ fontSize: 'var(--t-lg)', fontWeight: 600 }}>{title}</span>
          <button
            onClick={onClose}
            aria-label="close"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-mute)', padding: 4,
            }}
          ><X size={14} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 'var(--t-sm)', color: 'var(--text-mute)',
      textTransform: 'uppercase', letterSpacing: '0.04em',
      marginBottom: 'var(--s2)',
    }}>{children}</div>
  );
}

function InlineAlert({ message, onDismiss }: { message: string; onDismiss?: () => void }) {
  return (
    <div className="alert">
      <span style={{ whiteSpace: 'pre-wrap' }}>{message}</span>
      {onDismiss && <button className="alert__dismiss" onClick={onDismiss} aria-label="dismiss">×</button>}
    </div>
  );
}
