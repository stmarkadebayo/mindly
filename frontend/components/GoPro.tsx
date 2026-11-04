"use client";
// Going Pro is a two-step choice: this sheet says what you get and what it costs, and only "Continue" opens the payment page.
import { useCallback, useState } from "react";
import { api } from "@/lib/api";
import { usePricing } from "@/lib/pricing";
import { useSession } from "./Session";
import { useUI } from "./UI";

function GoProBody({ close }: { close: () => void }) {
  const { config } = useSession();
  const { toast } = useUI();
  const pricing = usePricing(config.prices);
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    try { window.location.href = (await api<{ url: string }>("/api/billing/checkout", { method: "POST", json: { currency: pricing.currency } })).url; }
    catch (e) { toast((e as Error).message); setBusy(false); }
  };
  return (
    <>
      <h2>Mindly Pro</h2>
      <p>{pricing.label ? `${pricing.label}. ` : ""}Cancel any time.</p>
      <ul className="pro-list">
        <li>Unlimited speech, no daily limit</li>
        <li>Room mode for conversations</li>
      </ul>
      <p className="footnote">Writing, reading and every page you&apos;ve made stay free.</p>
      {pricing.options.length > 1 && (
        <div className="segmented" style={{ margin: "0 auto var(--sp3)" }}>{pricing.options.map((c) => (
          <button key={c} aria-pressed={pricing.currency === c} onClick={() => pricing.choose(c)}>{c === "NGN" ? "₦ Naira" : "$ Dollars"}</button>))}</div>
      )}
      <div className="alert-actions">
        <button className="quiet" onClick={close}>Not now</button>
        <button className="primary" disabled={busy} onClick={go}>Continue</button>
      </div>
    </>
  );
}

/** Returns a function that opens the Pro sheet (or says payments aren't on yet). */
export function useGoPro() {
  const { config } = useSession();
  const { sheet, toast } = useUI();
  return useCallback(() => {
    if (!config.billing) return toast("Payments aren't switched on yet.");
    sheet((close) => <GoProBody close={close} />, undefined, "alert");
  }, [config.billing, sheet, toast]);
}
