"use client";
import Link from "next/link";
import { openCount, overdue } from "@/lib/actions";
import { dayLabel, moodColor, timeLabel } from "@/lib/content";
import { excerpt } from "@/lib/text";
import type { Entry } from "@/lib/types";

/** Entries grouped by day, newest first (the store already returns them in that order). */
export function EntryList({ entries, activeId, headRight }: { entries: Entry[]; activeId?: string | null; headRight?: React.ReactNode }) {
  const groups: [string, Entry[]][] = [];
  for (const e of entries) {
    const label = dayLabel(e.created);
    if (groups.at(-1)?.[0] !== label) groups.push([label, []]);
    groups.at(-1)![1].push(e);
  }
  return (
    <>
      {groups.map(([label, list], gi) => (
        <section key={label}>
          {gi === 0 && headRight ? <div className="label-row"><h2 className="section-label">{label}</h2>{headRight}</div> : <h2 className="section-label">{label}</h2>}
          <div className="group">
            {list.map((e) => {
              const pending = e.segments.some((s) => ["saved", "transcribing", "writing", "queued"].includes(s.status));
              const failed = e.segments.some((s) => s.status === "failed");
              const silent = !e.body.trim() && !e.title && e.segments.length > 0 && e.segments.every((s) => s.status === "no_speech");
              return (
                <Link key={e.id} className="row entry-row" href={`/entry/?id=${e.id}`} aria-current={e.id === activeId ? "page" : undefined}>
                  <span className="dot" style={{ background: moodColor(e.mood) }} aria-hidden="true" />
                  <span className="grow">
                    <span className="t" style={{ display: "block" }}>{e.title || (silent ? "Nothing heard" : pending ? "Writing your entry…" : e.prompt || "Untitled")}{e.sample && <span className="pill">Sample</span>}<TodoBadge entry={e} /></span>
                    <span className="x">{excerpt(e.body) || (silent ? "No words came through in this recording." : failed ? "Couldn't finish writing this one. Tap to try again." : pending ? "" : "No words yet.")}</span>
                  </span>
                  <span className="time">{timeLabel(e.created)}</span>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </>
  );
}

/** A small "something here still needs you" mark: a hand-drawn tick in a circle and how many. It turns accent-coloured when a reminder is due. */
function TodoBadge({ entry }: { entry: Entry }) {
  const n = openCount(entry);
  if (!n) return null;
  return (
    <span className={`todo-badge${overdue(entry) ? " late" : ""}`} title={`${n} still to do`} aria-label={`${n} still to do`}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3.4c4.8-.2 8.6 3.5 8.6 8.5s-3.8 8.7-8.7 8.7S3.3 16.8 3.4 12 7.3 3.6 12 3.4z" /><path d="M8 12.3l2.8 2.8 5.2-5.7" /></svg>
      {n}
    </span>
  );
}

/** Words typed in a search box must all appear in the title, body or prompt. */
export function matches(e: Entry, q: string, plain: (s: string) => string) {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  return words.every((w) => `${e.title} ${plain(e.body)} ${e.prompt ?? ""}`.toLowerCase().includes(w));
}
