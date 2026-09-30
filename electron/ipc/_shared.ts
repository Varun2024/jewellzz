import type { IpcMain } from 'electron';
import { z } from 'zod';
import { getDb } from '../db';
import { assertRole, currentActor } from '../auth';

// Channels that skip the auth gate (login flow, whoami before user picks account, cheap health probe).
export const OPEN_CHANNELS: ReadonlySet<string> = new Set([
  'auth.list', 'auth.whoami', 'auth.login', 'app.ping',
]);

// Wrap a handler with zod validation + role gate.
export function on<S extends z.ZodTypeAny, R>(
  ipc: IpcMain,
  channel: string,
  schema: S | null,
  fn: (input: z.infer<S>) => R,
): void {
  ipc.handle(channel, (_e, payload) => {
    if (!OPEN_CHANNELS.has(channel)) assertRole(channel);
    const input = schema ? schema.parse(payload) : (payload as z.infer<S>);
    return fn(input);
  });
}

export function audit(
  entity: string,
  entityId: number | null,
  action: string,
  before: unknown,
  after: unknown,
): void {
  getDb()
    .prepare(
      `INSERT INTO audit_log (actor, entity, entity_id, action, before, after)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      currentActor(),
      entity,
      entityId,
      action,
      before ? JSON.stringify(before) : null,
      after ? JSON.stringify(after) : null,
    );
}

// Escape a user query for FTS5 so operator characters don't blow up the parser.
export function toFtsQuery(q: string): string {
  const cleaned = q
    .trim()
    .replace(/["*()]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  if (cleaned.length === 0) return '""';
  return cleaned.map((t) => `"${t}"*`).join(' ');
}
