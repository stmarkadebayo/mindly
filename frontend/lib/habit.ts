// The daily habit, worked out from the entries on this device: one entry a day is the goal, more is a bonus.
import type { Entry } from "./types";

const p = (n: number) => String(n).padStart(2, "0");
export const dayKey = (d: Date) => `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;

export interface Habit {
  today: number;
  streak: number;
  /** The last seven days, oldest first, with how many entries each had. */
  week: { key: string; count: number }[];
}

/**
 * Streak = consecutive days with an entry. It forgives: one missed day is bridged (at most once in any seven days),
 * so a single slip doesn't wipe out a good run. A day not yet journaled today doesn't break it either.
 */
export function habit(entries: Entry[], now = new Date()): Habit {
  const days = new Map<string, number>();
  for (const e of entries) {
    if (e.sample || !(e.body.trim() || e.segments.length)) continue;
    const k = dayKey(new Date(e.created));
    days.set(k, (days.get(k) ?? 0) + 1);
  }
  const at = (back: number) => { const d = new Date(now); d.setDate(d.getDate() - back); return dayKey(d); };

  const today = days.get(at(0)) ?? 0;
  let streak = 0, lastForgiven = -99;
  for (let back = today ? 0 : 1; back < 730; back++) {
    if (days.has(at(back))) { streak++; continue; }
    if (back - lastForgiven >= 7 && days.has(at(back + 1))) { lastForgiven = back; continue; }
    break;
  }
  const week = Array.from({ length: 7 }, (_, i) => ({ key: at(6 - i), count: days.get(at(6 - i)) ?? 0 }));
  return { today, streak, week };
}

/** The longest run of consecutive days with an entry, ever. Unlike the streak shown on Home it never forgives a gap. */
export function bestStreak(entries: Entry[]): number {
  const days = [...new Set(entries.filter((e) => !e.sample && (e.body.trim() || e.segments.length)).map((e) => dayKey(new Date(e.created))))].sort();
  let best = 0, run = 0, prev = 0;
  for (const k of days) {
    const t = new Date(`${k}T12:00:00`).getTime();
    run = prev && Math.round((t - prev) / 864e5) === 1 ? run + 1 : 1;
    prev = t;
    best = Math.max(best, run);
  }
  return best;
}
