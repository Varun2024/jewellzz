import type { IpcMain } from 'electron';
import { z } from 'zod';
import { getDb } from '../db';
import {
  whoami, login, logout, listActiveUsers, listAllUsers,
  createUser, setUserPin, deactivateUser,
} from '../auth';
import { CH } from '../../shared/ipc';
import { on, audit } from './_shared';

export function register(ipc: IpcMain): void {
  on(ipc, CH.authListUsers, null, () => listActiveUsers(getDb()));
  on(ipc, CH.authWhoami, null, () => whoami());
  on(
    ipc,
    CH.authLogin,
    z.object({ userId: z.number().int(), pin: z.string().min(4).max(8) }),
    ({ userId, pin }) => login(getDb(), userId, pin),
  );
  on(ipc, CH.authLogout, null, () => { logout(); return { ok: true }; });

  on(ipc, 'users.list', null, () => listAllUsers(getDb()));
  on(
    ipc,
    CH.usersCreate,
    z.object({ name: z.string().min(1).max(60), role: z.enum(['owner', 'counter']), pin: z.string().regex(/^\d{4,8}$/) }),
    (p) => {
      const r = createUser(getDb(), p);
      audit('user', r.id, 'create', null, { name: p.name, role: p.role });
      return r;
    },
  );
  on(
    ipc,
    CH.usersSetPin,
    z.object({ id: z.number().int(), pin: z.string().regex(/^\d{4,8}$/) }),
    ({ id, pin }) => { setUserPin(getDb(), id, pin); audit('user', id, 'pin_change', null, null); return { ok: true }; },
  );
  on(
    ipc,
    CH.usersDeactivate,
    z.object({ id: z.number().int() }),
    ({ id }) => { deactivateUser(getDb(), id); audit('user', id, 'deactivate', null, null); return { ok: true }; },
  );
}
