"use client";
// The streak, as a small pill in the top bar. One entry a day is the goal; the pill nudges without nagging.
import { useEffect, useState } from "react";
import { habit, type Habit as H } from "@/lib/habit";
import * as store from "@/lib/store";

export function StreakPill() {
  const [h, setH] = useState<H | null>(null);
  useEffect(() => {
    const load = () => store.entries().then((e) => setH(habit(e)));
    load();
    window.addEventListener("mindly:entry", load);
    return () => window.removeEventListener("mindly:entry", load);
  }, []);
  if (!h) return null;
  const label = h.streak > 0 ? `${h.streak}-day streak` : "Start your streak";
  const tip = h.today >= 2 ? `Bonus! ${h.today} entries today` : h.today === 1 ? "Today's entry is done" : h.streak ? "Keep it going today" : "One entry starts it";
  return <span className={`streak-pill${h.today ? " done" : ""}`} title={tip} aria-label={`${label}. ${tip}`}>{h.streak > 0 && <span aria-hidden="true">🔥 </span>}{label}</span>;
}
