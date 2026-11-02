// Plan wording shared by the Today card and Settings.
import type { User } from "./types";

export const daysLeft = (until: number | null) => Math.max(0, Math.ceil(((until ?? 0) * 1000 - Date.now()) / 864e5));

export function planLine(me: User): string {
  if (me.paid) return "Mindly Pro";
  if (me.on_trial) { const d = daysLeft(me.trial_ends); return `Pro trial · ${d} ${d === 1 ? "day" : "days"} left`; }
  return "Free plan";
}
