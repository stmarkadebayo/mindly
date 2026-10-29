// Decide which journal entries a chat request carries. Sending the whole journal on every message would be slow and
// would put far more of someone's writing on the wire than a reply needs, so we send the entry being read, the
// entries most like the conversation, and the latest few, each trimmed.
import { plain } from "./text";
import type { Entry } from "./types";

const STOP = new Set(["that", "this", "with", "have", "from", "what", "your", "about", "been", "were", "they", "them", "then",
  "there", "would", "could", "just", "like", "really", "know", "think", "also", "when", "where", "which", "while", "today", "feel"]);

const words = (text: string) => new Set((text.toLowerCase().match(/\p{L}{4,}/gu) ?? []).filter((w) => !STOP.has(w)));

export interface ContextEntry { id: string; created: string; title: string | null; body: string }

export function pickContext(
  all: Entry[], query: string, anchorId: string | null,
  { related = 24, recent = 8, bodyChars = 1200, anchorChars = 6000 } = {},
): ContextEntry[] {
  const written = all.filter((e) => plain(e.body)); // `all` is newest first
  const others = written.filter((e) => e.id !== anchorId);
  const q = words(query);
  const similar = others
    .map((e) => { const w = words(`${e.title} ${plain(e.body)}`); let n = 0; q.forEach((x) => w.has(x) && n++); return { e, n }; })
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n)
    .slice(0, related)
    .map((x) => x.e);

  const chosen = new Map<string, Entry>();
  const anchor = anchorId ? all.find((e) => e.id === anchorId) : undefined;
  if (anchor) chosen.set(anchor.id, anchor);
  [...similar, ...others.slice(0, recent)].forEach((e) => chosen.set(e.id, e));
  return [...chosen.values()].map((e) => ({
    id: e.id, created: e.created, title: e.title || null, body: plain(e.body).slice(0, e.id === anchorId ? anchorChars : bodyChars),
  }));
}
