"use client";
// Every entry, newest first. On a wide screen the sidebar already is this, so the pill hides the link there.
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { EntryList, matches } from "@/components/EntryList";
import { Underline } from "@/components/Hand";
import { Icon } from "@/components/Icon";
import { openCount } from "@/lib/actions";
import * as store from "@/lib/store";
import { plain } from "@/lib/text";
import type { Entry } from "@/lib/types";

export default function JournalPage() {
  return <Suspense><Journal /></Suspense>;
}

function Journal() {
  const router = useRouter();
  const params = useSearchParams();
  const ids = params.get("ids")?.split(",").filter(Boolean) ?? null;   // set when you arrive from an Insights theme
  const label = params.get("label") ?? "";
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [q, setQ] = useState("");
  const [searching, setSearching] = useState(false);
  const [todo, setTodo] = useState(false);
  const box = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const load = () => store.entries().then(setEntries);
    load();
    window.addEventListener("mindly:entry", load);
    return () => window.removeEventListener("mindly:entry", load);
  }, []);
  useEffect(() => { if (searching) box.current?.focus(); }, [searching]);

  const real = (entries ?? []).filter((e) => e.body.trim() || e.title || e.segments.length);
  const open = real.filter((e) => openCount(e) > 0);
  const shown = (todo ? open : real).filter((e) => (!ids || ids.includes(e.id)) && matches(e, q, plain));
  const words = real.reduce((n, e) => n + (plain(e.body).split(/\s+/).filter(Boolean).length), 0);

  return (
    <main className="screen journal">
      <header className="journal-head">
        <h1 className="large-title"><span className="name">Journal<span className="underline"><Underline /></span></span></h1>
        {real.length > 0 && <button className="icon-btn" aria-label={searching ? "Close search" : "Search your journal"} onClick={() => { setSearching((s) => !s); if (searching) setQ(""); }}><Icon name={searching ? "close" : "search"} /></button>}
      </header>
      {real.length > 0 && <p className="journal-sub">{real.length} {real.length === 1 ? "entry" : "entries"} · {words.toLocaleString()} words</p>}

      {searching && <div className="search journal-search"><Icon name="search" /><input ref={box} className="input" type="search" placeholder="Search your words" aria-label="Search your journal" value={q} onChange={(e) => setQ(e.target.value)} /></div>}

      {ids && (
        <div className="chips journal-filters">
          <button className="chip small" aria-pressed="true" onClick={() => router.replace("/journal/")} aria-label="Clear filter">{label || "From Insights"} · {shown.length} ✕</button>
        </div>
      )}

      {!ids && open.length > 0 && (
        <div className="chips journal-filters" role="group" aria-label="Filter">
          <button className="chip small" aria-pressed={!todo} onClick={() => setTodo(false)}>All</button>
          <button className="chip small" aria-pressed={todo} onClick={() => setTodo(true)}>To do · {open.length}</button>
        </div>
      )}

      {entries && real.length === 0 && <p className="empty-note">Your entries will gather here.</p>}
      {real.length > 0 && shown.length === 0 && <p className="empty-note">{q ? <>Nothing matches &ldquo;{q}&rdquo;.</> : "All caught up."}</p>}
      <EntryList entries={shown} />
    </main>
  );
}
