// Journal levels: a plain, transparent score from three things you actually do, worked out from the entries on this device.
//   score = words / 10  +  20 per day you wrote  +  15 per day of your best streak
import { bestStreak, dayKey, habit } from "./habit";
import { plain } from "./text";
import type { Entry } from "./types";

export const LEVELS = [
  { name: "Blank Page", at: 0, note: "Every journal starts empty." },
  { name: "First Lines", at: 60, note: "You've started putting yourself on the page." },
  { name: "Margin Notes", at: 200, note: "Small thoughts, written down often." },
  { name: "Notebook", at: 500, note: "A real habit is taking shape." },
  { name: "Storyteller", at: 1000, note: "Your days are becoming a story." },
  { name: "Chronicler", at: 2000, note: "You keep a faithful record of your life." },
  { name: "Keeper of Days", at: 4000, note: "A journal many years in the making." },
] as const;

export interface Progress {
  score: number; level: number; name: string; next: (typeof LEVELS)[number] | null;
  /** 0 to 1 towards the next level (1 at the top). */
  pct: number; words: number; days: number; best: number; streak: number;
}

export function progress(all: Entry[]): Progress {
  const mine = all.filter((e) => !e.sample && (e.body.trim() || e.segments.length));
  const words = mine.reduce((n, e) => n + (plain(e.body).match(/\S+/g)?.length ?? 0), 0);
  const days = new Set(mine.map((e) => dayKey(new Date(e.created)))).size;
  const best = bestStreak(all);
  const score = Math.floor(words / 10) + 20 * days + 15 * best;
  const level = LEVELS.reduce((l, v, i) => (score >= v.at ? i : l), 0);
  const next = LEVELS[level + 1] ?? null;
  const pct = next ? (score - LEVELS[level].at) / (next.at - LEVELS[level].at) : 1;
  return { score, level, name: LEVELS[level].name, next, pct, words, days, best, streak: habit(all).streak };
}
