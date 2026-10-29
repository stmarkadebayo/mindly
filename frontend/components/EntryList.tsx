"use client";
import Link from "next/link";
import { dayLabel, moodColor, timeLabel } from "@/lib/content";
import { excerpt } from "@/lib/text";
import type { Entry } from "@/lib/types";

/** Entries grouped by day, newest first (the store already returns them in that order). */
export function EntryList({ entries, activeId }: { entries: Entry[]; activeId?: string | null }) {
  const groups: [string, Entry[]][] = [];
  for (const e of entries) {
    const label = dayLabel(e.created);
    if (groups.at(-1)?.[0] !== label) groups.push([label, []]);
    groups.at(-1)![1].push(e);
  }
  return (
    <>
      {groups.map(([label, list]) => (
        <section key={label}>
          <h2 className="section-label">{label}</h2>
          <div className="group">
            {list.map((e) => {
              const pending = e.segments.some((s) => ["saved", "transcribing", "writing", "queued"].includes(s.status));
              const failed = e.segments.some((s) => s.status === "failed");
              const silent = !e.body.trim() && !e.title && e.segments.length > 0 && e.segments.every((s) => s.status === "no_speech");
              return (
                <Link key={e.id} className="row entry-row" href={`/entry/?id=${e.id}`} aria-current={e.id === activeId ? "page" : undefined}>
                  <span className="dot" style={{ background: moodColor(e.mood) }} aria-hidden="true" />
                  <span className="grow">
                    <span className="t" style={{ display: "block" }}>{e.title || (silent ? "Nothing heard" : pending ? "Writing your entry…" : e.prompt || "Untitled")}</span>
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

/** Words typed in a search box must all appear in the title, body or prompt. */
export function matches(e: Entry, q: string, plain: (s: string) => string) {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  return words.every((w) => `${e.title} ${plain(e.body)} ${e.prompt ?? ""}`.toLowerCase().includes(w));
}
