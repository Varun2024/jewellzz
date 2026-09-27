export {};

declare global {
  interface Window {
    jewelzz: {
      invoke<T = unknown>(channel: string, payload?: unknown): Promise<T>;
    };
  }
}
