"use client";
// A small card under the top bar about the plan. It appears once a day and clears itself after a few seconds.
import Link from "next/link";
import { useEffect, useState } from "react";
import { daysLeft } from "@/lib/plan";
import { usePricing } from "@/lib/pricing";
import { useSession } from "./Session";

const KEY = "mindly.tip.plan";
const SHOW_MS = 5000;

export function TrialCard() {
  const { me, config } = useSession();
  const pricing = usePricing(config.prices);
  const [shown, setShown] = useState(false);
  // A short reminder, not a fixture: it appears once a day when Today opens and clears itself after a few seconds.
  useEffect(() => {
    if (!me || me.paid) return;
    const today = new Date().toDateString();
    try { if (localStorage.getItem(KEY) === today) return; localStorage.setItem(KEY, today); } catch { /* show it anyway */ }
    setShown(true);
    const t = setTimeout(() => setShown(false), SHOW_MS);
    return () => clearTimeout(t);
  }, [me?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!me || me.paid || !shown) return null;

  const left = daysLeft(me.trial_ends);
  const price = pricing.label;
  return (
    <aside className="tip glass" aria-label="Your plan">
      <span className="tip-timer" aria-hidden style={{ animationDuration: `${SHOW_MS}ms` }} />
      <div className="tip-text">
        {me.on_trial
          ? <><b>{left} {left === 1 ? "day" : "days"} of Pro left</b><span>{price ? `${price} after. ` : ""}Keep unlimited speech.</span></>
          : <><b>You&apos;re on the free plan</b><span>{config.free_minutes ?? 10} minutes of speech a day. Pro is unlimited.</span></>}
      </div>
      <Link className="btn btn-primary tip-btn" href="/settings/#plan">Plans</Link>
      <button className="icon-btn tip-x" aria-label="Dismiss" onClick={() => setShown(false)}>×</button>
    </aside>
  );
}
