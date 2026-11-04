// The "From your words" reading of recent entries. It is worked out in the background after you write, so by the time you
// open Insights it is already there. The result is cached on this device and only redone when the entries change.
import { api } from "./api";
import { plain } from "./text";
import type { Entry } from "./types";

export interface Ai { headline: string; themes: { label: string; ids: string[] }[]; noticed: { text: string; ids: string[] }[]; try: string }

const MIN_ENTRIES = 3, MAX_ENTRIES = 30;
const keyFor = (userId: string) => `mindly-insights-${userId}`;
const rejectedKey = (userId: string) => `mindly-insights-rejected-${userId}`;

/** Observations the person marked "not quite right". They are hidden at once and the next reading is told not to repeat them. */
export function rejected(userId: string): string[] {
  try { const v = JSON.parse(localStorage.getItem(rejectedKey(userId)) || "[]"); return Array.isArray(v) ? v : []; } catch { return []; }
}
export function reject(userId: string, text: string) {
  try { localStorage.setItem(rejectedKey(userId), JSON.stringify([text, ...rejected(userId).filter((t) => t !== text)].slice(0, 20))); } catch { /* not saved */ }
  window.dispatchEvent(new Event("mindly:insights"));
}
const written = (all: Entry[]) => all.filter((e) => plain(e.body)).slice(0, MAX_ENTRIES);
export const enough = (all: Entry[]) => written(all).length >= MIN_ENTRIES;

// The reading is kept steady on purpose: it is not redone for every new entry. A new one is made only once three or more new entries
// have come in, or a week has passed and there is something new to read. The old themes are passed along so the topics stay familiar.
const NEW_ENTRIES = 3, WEEK = 7 * 864e5;
interface Saved { res: Ai; ids: string[]; at: number }
const saved = (userId: string): Saved | null => {
  try { const c = JSON.parse(localStorage.getItem(keyFor(userId)) || "null"); return c?.res ? { res: c.res, ids: Array.isArray(c.ids) ? c.ids : [], at: c.at ?? 0 } : null; } catch { return null; }
};

/** The saved reading, whatever its age. */
export const cached = (userId: string): Ai | null => saved(userId)?.res ?? null;

function due(have: Saved | null, all: Entry[]): boolean {
  if (!have) return true;
  const fresh = written(all).filter((e) => !have.ids.includes(e.id)).length;
  return fresh >= NEW_ENTRIES || (fresh >= 1 && Date.now() - have.at >= WEEK);
}

let inflight: Promise<Ai | null> | null = null;

/** The reading to show: the saved one, unless it is due for renewal. Callers share one request, so opening the page mid-way doesn't start a second. */
export function refresh(userId: string, all: Entry[]): Promise<Ai | null> {
  if (!enough(all)) return Promise.resolve(null);
  const have = saved(userId);
  if (have && !due(have, all)) return Promise.resolve(have.res);
  inflight ??= (async () => {
    try {
      const res = await api<Ai>("/api/insights", { method: "POST", json: {
        entries: written(all).map((e) => ({ id: e.id, created: e.created, title: e.title, body: plain(e.body).slice(0, 900) })),
        avoid: rejected(userId), keep: have?.res.themes.map((t) => t.label) ?? [] } });
      try { localStorage.setItem(keyFor(userId), JSON.stringify({ res, ids: written(all).map((e) => e.id), at: Date.now() })); } catch { /* not cached */ }
      window.dispatchEvent(new Event("mindly:insights"));
      return res;
    } finally { inflight = null; }
  })();
  return inflight;
}
