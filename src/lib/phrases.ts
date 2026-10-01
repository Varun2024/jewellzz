// Ledger-flavored loading phrases. Rotates through the list so no two loads in
// a row say the same thing — the app has a voice, not a script.
//
// Import a specific `loading()` per context so the phrase matches the surface:
//   loading('list')   → "opening the ledger…"
//   loading('mutate') → "sealing the entry…"
//   loading('search') → "consulting the ledger…"
//   loading('bootup') → "unlocking the counter…"

const POOLS = {
  list: [
    'opening the ledger…',
    'turning the page…',
    'reading the page…',
    'checking the ledger…',
  ],
  mutate: [
    'sealing the entry…',
    'weighing…',
    'pressing the stamp…',
    'inking the page…',
  ],
  search: [
    'consulting the ledger…',
    'looking through the pages…',
    'searching the case…',
  ],
  bootup: [
    'unlocking the counter…',
    'opening the shop…',
  ],
  quiet: [
    'a moment…',
    'one moment…',
  ],
} as const;

type Pool = keyof typeof POOLS;

// Track the last index per pool so consecutive calls don't repeat.
const lastIndex: Partial<Record<Pool, number>> = {};

export function loading(pool: Pool = 'quiet'): string {
  const list = POOLS[pool];
  const prev = lastIndex[pool] ?? -1;
  let i = Math.floor(Math.random() * list.length);
  if (list.length > 1 && i === prev) i = (i + 1) % list.length;
  lastIndex[pool] = i;
  return list[i];
}
