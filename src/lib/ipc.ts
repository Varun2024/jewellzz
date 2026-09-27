import { CH } from '@shared/ipc';

export function invoke<T = unknown>(channel: string, payload?: unknown): Promise<T> {
  return window.jewelzz.invoke<T>(channel, payload);
}

export { CH };
