// SQLite rows come back with snake_case columns. Renderer expects camelCase.
// One helper replaces per-table mapParty/mapItem/mapKarigar/mapRate one-off fns.

export function camelize<T = Record<string, unknown>>(row: unknown): T {
  if (row === null || typeof row !== 'object') return row as T;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row as Record<string, unknown>)) {
    out[k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())] = v;
  }
  return out as T;
}
