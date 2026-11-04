// What is still open in an entry, worked out from its own text so a tick in the page and a tick in a card can never disagree.
import type { Entry, Suggestion } from "./types";

const unchecked = (body: string) => body.split("\n").filter((l) => l.startsWith("☐ "));

/** Reminders the person accepted whose checklist line is still unticked. */
export function openReminders(e: Pick<Entry, "body" | "suggestions">, body = e.body): Suggestion[] {
  const lines = unchecked(body);
  return (e.suggestions ?? []).filter((s) => s.status === "accepted" && s.kind === "reminder" && lines.some((l) => l.startsWith(`☐ ${s.text}`)));
}

/** How many things in this entry still need the person: unticked checklist lines, plus suggestions waiting for a yes or no. */
export function openCount(e: Entry): number {
  return unchecked(e.body).length + (e.suggestions ?? []).filter((s) => s.status === "pending").length;
}

/** True when an accepted reminder has come due and is still open. */
export const overdue = (e: Entry) => openReminders(e).some((s) => s.when && new Date(s.when).getTime() <= Date.now());
