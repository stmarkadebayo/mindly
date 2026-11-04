"use client";
// A seven-dot strip on Today for the first week of writing: a small, visible goal that goes away once the week is over.
import Link from "next/link";
import { dayKey } from "@/lib/habit";
import type { Entry } from "@/lib/types";

const DAY = 864e5;

export function FirstWeek({ entries }: { entries: Entry[] }) {
  const real = entries.filter((e) => !e.sample);
  const first = real.length ? Math.min(...real.map((e) => +new Date(e.created))) : Date.now();
  const start = new Date(first); start.setHours(0, 0, 0, 0);
  const days = Array.from({ length: 7 }, (_, i) => new Date(+start + i * DAY));
  const written = new Set(real.map((e) => dayKey(new Date(e.created))));
  const today = dayKey(new Date());
  const done = days.filter((d) => written.has(dayKey(d))).length;
  if (Date.now() >= +start + 7 * DAY || done === 7) return null;

  const wroteToday = written.has(today);
  const caption = done === 0 ? "Say anything. A few words is enough."
    : done === 1 ? (wroteToday ? "Page one is in. Come back tomorrow to start a streak." : "Write again today to start a streak.")
    : done === 2 ? "Two days. Keep it going."
    : null;
  return (
    <section className="first-week" aria-label="Your first week">
      <p className="section-label">Your first week</p>
      <div className="week-dots" role="img" aria-label={`${done} of 7 days written`}>
        {days.map((d) => { const k = dayKey(d); return <i key={k} className={`${written.has(k) ? "on" : ""}${k === today ? " today" : ""}`} />; })}
      </div>
      <p className="week-note">{caption ?? <>{done} days in. Try a <Link href="/talk/?new=1">reflection</Link> tonight.</>}</p>
    </section>
  );
}
