import { contextBridge, ipcRenderer } from 'electron';

const api = {
  invoke: <T = unknown>(channel: string, payload?: unknown) =>
    ipcRenderer.invoke(channel, payload) as Promise<T>,
};

contextBridge.exposeInMainWorld('jewelzz', api);

export type JewelzzApi = typeof api;
