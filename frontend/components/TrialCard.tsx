"use client";
// A small card under the top bar about the plan. Dismissed for the day; it comes back when the trial is nearly over.
import Link from "next/link";
import { useEffect, useState } from "react";
import { daysLeft } from "@/lib/plan";
import { useSession } from "./Session";

const KEY = "mindly.tip.plan";

export function TrialCard() {
  const { me, config } = useSession();
  const [hidden, setHidden] = useState(true);
  const left = daysLeft(me?.trial_ends ?? null);
  // Everyone gets a fresh nudge once the trial is in its last week, and each day after it ends.
  const stamp = me?.on_trial ? (left > 7 ? "trial" : `last-${left}`) : `free-${new Date().toDateString()}`;
  useEffect(() => {
    try { setHidden(localStorage.getItem(KEY) === stamp); } catch { setHidden(false); }
  }, [stamp]);
  if (!me || me.paid || hidden) return null;

  const price = config.pro_price || "$7/month";
  const dismiss = () => { try { localStorage.setItem(KEY, stamp); } catch { /* ignore */ } setHidden(true); };
  return (
    <aside className="tip glass" aria-label="Your plan">
      <div className="tip-text">
        {me.on_trial
          ? <><b>{left} {left === 1 ? "day" : "days"} of Pro left</b><span>{price} after. Keep unlimited speech.</span></>
          : <><b>You&apos;re on the free plan</b><span>{config.free_minutes ?? 10} minutes of speech a day. Pro is unlimited.</span></>}
      </div>
      <Link className="btn btn-primary tip-btn" href="/settings/#plan">Plans</Link>
      <button className="icon-btn tip-x" aria-label="Dismiss" onClick={dismiss}>×</button>
    </aside>
  );
}
