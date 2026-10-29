"use client";
import { useState } from "react";
import { addSample } from "@/lib/sample";
import { useUI } from "./UI";

/** Shown while the journal is empty: loads a few example entries so Insights, Reflect and Chat have something to work with. */
export function SampleOffer() {
  const { toast } = useUI();
  const [busy, setBusy] = useState(false);
  const load = async () => {
    setBusy(true);
    try {
      await addSample();
      window.dispatchEvent(new Event("mindly:entry"));
      toast("Sample journal added. Remove it any time in Settings.");
    } catch { toast("Couldn't add the sample journal."); }
    setBusy(false);
  };
  return (
    <div className="sample-offer">
      <button className="btn btn-tinted" onClick={load} disabled={busy}>{busy ? "Adding…" : "Try a sample journal"}</button>
      <p className="footnote">Adds 11 example entries to this device so you can see Insights, Reflect and Chat. You can edit them, add your own, and remove them in Settings.</p>
    </div>
  );
}
