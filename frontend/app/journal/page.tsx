"use client";
// Every entry, newest first, with search. On a wide screen the sidebar already is this, so the pill hides the link there.
import { useEffect, useState } from "react";
import { EntryList, matches } from "@/components/EntryList";
import { Icon } from "@/components/Icon";
import { SampleOffer } from "@/components/SampleOffer";
import * as store from "@/lib/store";
import { plain } from "@/lib/text";
import type { Entry } from "@/lib/types";

export default function Journal() {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [q, setQ] = useState("");
  useEffect(() => {
    const load = () => store.entries().then(setEntries);
    load();
    window.addEventListener("mindly:entry", load);
    return () => window.removeEventListener("mindly:entry", load);
  }, []);
  const real = (entries ?? []).filter((e) => e.body.trim() || e.title || e.segments.length);
  const shown = real.filter((e) => matches(e, q, plain));
  return (
    <main className="screen">
      <h1 className="title" style={{ margin: "12px 0" }}>Journal</h1>
      {real.length > 0 && <div className="search"><Icon name="search" /><input className="input" type="search" placeholder="Search your journal" aria-label="Search your journal" value={q} onChange={(e) => setQ(e.target.value)} /></div>}
      {entries && real.length === 0 && <><p className="empty-note">Your entries will gather here.</p><SampleOffer /></>}
      {real.length > 0 && shown.length === 0 && <p className="empty-note">Nothing matches &ldquo;{q}&rdquo;.</p>}
      <EntryList entries={shown} />
    </main>
  );
}
