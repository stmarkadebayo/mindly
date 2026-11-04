// The few browser pieces the journal code touches: IndexedDB (in memory), window events, navigator.onLine and localStorage.
import "fake-indexeddb/auto";
import { beforeEach } from "vitest";

const g = globalThis as Record<string, unknown>;
g.window ??= new EventTarget();
if (!("navigator" in globalThis) || !("onLine" in (globalThis.navigator as object)))
  Object.defineProperty(globalThis, "navigator", { value: { onLine: true }, configurable: true, writable: true });

const memory = new Map<string, string>();
g.localStorage = {
  getItem: (k: string) => memory.get(k) ?? null,
  setItem: (k: string, v: string) => void memory.set(k, String(v)),
  removeItem: (k: string) => void memory.delete(k),
  clear: () => memory.clear(),
};

beforeEach(() => {
  memory.clear();
  (globalThis.navigator as { onLine: boolean }).onLine = true;
});
