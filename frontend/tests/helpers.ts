import * as store from "@/lib/store";
import type { Entry } from "@/lib/types";

/** A fresh, empty journal for each test. */
export const freshJournal = () => store.open(`test-${crypto.randomUUID()}`);

/** An entry written on a given day (local time, midday), with some words in it. */
export const entryOn = (day: Date | string, body = "a few words here", extra: Partial<Entry> = {}): Entry => {
  const d = typeof day === "string" ? new Date(`${day}T12:00:00`) : day;
  return { id: crypto.randomUUID(), created: d.toISOString(), updated: d.toISOString(), title: "", body, prompt: null, mood: null, segments: [], ...extra };
};

/** Replaces fetch with a router of canned server replies; returns the calls made. */
export function serve(routes: Record<string, (body: unknown) => unknown>) {
  const calls: { path: string; body: unknown }[] = [];
  globalThis.fetch = (async (path: string, init?: RequestInit) => {
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : init?.body;
    calls.push({ path, body });
    const route = routes[path];
    if (!route) return new Response("{}", { status: 404 });
    const out = await route(body);
    if (out instanceof Response) return out;
    return new Response(JSON.stringify(out), { status: 200 });
  }) as typeof fetch;
  return calls;
}
