"use client";
// Things the person said they'd do. They are offered on the entry page, where the words are, and only added when they accept.
// Accepted reminders come back as a small card on Home once they are due.
import { useCallback, useEffect, useState } from "react";
import { openReminders } from "@/lib/actions";
import * as store from "@/lib/store";
import type { Entry, Suggestion } from "@/lib/types";

export const when = (iso: string) =>
  new Date(iso).toLocaleString("en", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

/** The checklist line an accepted suggestion becomes. */
export const taskLine = (s: Suggestion) => `☐ ${s.text}${s.when ? ` (${when(s.when)})` : ""}`;

/** On the entry page: each pending suggestion with its buttons. `onAccept` adds the line to the page; the parent owns the text. */
export function EntrySuggestions({ entry, body, onAccept, onTick, onChange }: {
  entry: Entry; body: string; onAccept: (s: Suggestion) => void; onTick: (s: Suggestion) => void; onChange: (e: Entry) => void;
}) {
  const pending = (entry.suggestions ?? []).filter((s) => s.status === "pending");
  const set = async (s: Suggestion, status: Suggestion["status"]) => {
    const e = await store.updateEntry(entry.id, (x) => { const t = x.suggestions?.find((y) => y.id === s.id); if (t) t.status = status; });
    if (e) onChange(e);
  };
  const open = openReminders(entry, body);
  return <>{open.map((s) => (
    <div key={s.id} className="todo-row">
      <button className="todo-tick" aria-label={`Mark done: ${s.text}`} onClick={() => onTick(s)} />
      <span className="grow"><b>{s.text}</b>{s.when && <span className={`when${new Date(s.when).getTime() <= Date.now() ? " late" : ""}`}>{when(s.when)}</span>}</span>
    </div>
  ))}{pending.map((s) => (
    <div key={s.id} className="suggest-inline glass" role="status">
      <p className="suggest-text">
        {s.kind === "reminder" && s.when ? <>You mentioned <b>{s.text}</b> for {when(s.when)}. Remind you?</> : <>You mentioned <b>{s.text}</b>. Add it to your checklist?</>}
      </p>
      <div className="suggest-actions">
        <button className="chip small" onClick={async () => { onAccept(s); await set(s, "accepted"); }}>{s.kind === "reminder" && s.when ? "Remind me" : "Add"}</button>
        <button className="chip small" onClick={() => set(s, "dismissed")}>Not now</button>
      </div>
    </div>
  ))}</>;
}

/** On Home: an accepted reminder that has come due. */
export function DueReminders() {
  const [due, setDue] = useState<{ entry: Entry; s: Suggestion } | null>(null);
  const load = useCallback(() => store.entries().then((all) => {
    const now = Date.now();
    for (const entry of all) for (const s of openReminders(entry)) {   // still open in the text, so a tick in the entry clears it here too
      if (s.when && new Date(s.when).getTime() <= now) return setDue({ entry, s });
    }
    setDue(null);
  }), []);

  useEffect(() => {
    load();
    window.addEventListener("mindly:entry", load);
    return () => window.removeEventListener("mindly:entry", load);
  }, [load]);

  if (!due) return null;
  // "Done" also ticks the checklist line the reminder created. "Not yet" asks again in three hours.
  const done = async () => {
    await store.updateEntry(due.entry.id, (x) => {
      const t = x.suggestions?.find((y) => y.id === due.s.id);
      if (t) t.status = "done";
      x.body = x.body.split("\n").map((l) => (l.startsWith(`☐ ${due.s.text}`) ? l.replace("☐", "☑") : l)).join("\n");
    });
    load();
  };
  const notYet = async () => {
    const p = (n: number) => String(n).padStart(2, "0"), d = new Date(Date.now() + 3 * 3600_000);
    await store.updateEntry(due.entry.id, (x) => {
      const t = x.suggestions?.find((y) => y.id === due.s.id);
      if (t) t.when = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
    });
    load();
  };
  return (
    <div className="suggest glass" role="status">
      <p className="suggest-text">Reminder: <b>{due.s.text}</b></p>
      <div className="suggest-actions"><button className="chip small" onClick={done}>Done</button><button className="chip small" onClick={notYet}>Not yet</button></div>
    </div>
  );
}
