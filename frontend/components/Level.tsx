"use client";
// Journal levels: where you are, what moves you up, and the road ahead.
import { useEffect, useState } from "react";
import { LEVELS, progress, type Progress } from "@/lib/level";
import * as store from "@/lib/store";

/** The progress for this device's journal, kept fresh as entries change. */
export function useProgress(): Progress | null {
  const [p, setP] = useState<Progress | null>(null);
  useEffect(() => {
    const load = () => store.entries().then((e) => setP(progress(e)));
    load();
    window.addEventListener("mindly:entry", load);
    return () => window.removeEventListener("mindly:entry", load);
  }, []);
  return p;
}

export function LevelBody({ p }: { p: Progress }) {
  return (
    <div className="level">
      <p className="level-kicker">Level {p.level + 1} of {LEVELS.length}</p>
      <h2 className="level-name">{p.name}</h2>
      <p className="level-note">{LEVELS[p.level].note}</p>
      <div className="level-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(p.pct * 100)} aria-label="Progress to the next level">
        <i style={{ width: `${Math.max(4, p.pct * 100)}%` }} />
      </div>
      <p className="level-next">{p.next ? `${p.next.at - p.score} more points to ${p.next.name}` : "You've reached the top. Keep writing."}</p>
      <div className="level-stats">
        <span><b>{p.words.toLocaleString()}</b>words</span>
        <span><b>{p.days}</b>days written</span>
        <span><b>{p.best}</b>best streak</span>
      </div>
      <ul className="level-rules" aria-label="How points work">
        <li><b>1</b> point for every 10 words</li>
        <li><b>20</b> points for each day you write</li>
        <li><b>15</b> points for each day of your best streak</li>
      </ul>
      <ol className="level-list">
        {LEVELS.map((l, i) => <li key={l.name} className={i === p.level ? "now" : i < p.level ? "done" : ""}><span>{l.name}</span><small>{l.at ? `${l.at} pts` : "start"}</small></li>)}
      </ol>
    </div>
  );
}
