"use client";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { EntryList, matches } from "@/components/EntryList";
import { DueReminders } from "@/components/Suggestions";
import { AppHeader } from "@/components/AppHeader";
import { FirstWeek } from "@/components/FirstWeek";
import { TrialCard } from "@/components/TrialCard";
import { Underline } from "@/components/Hand";
import { Icon } from "@/components/Icon";
import { useMe } from "@/components/Session";
import { VoiceDock, type VoiceHandle } from "@/components/VoiceDock";
import { salutation, timePrompts } from "@/lib/content";
import * as pipeline from "@/lib/pipeline";
import type { Recording } from "@/lib/recorder";
import * as store from "@/lib/store";
import { plain } from "@/lib/text";
import type { Entry } from "@/lib/types";

const SEARCH_FROM = 8; // a handful of entries doesn't need a search box

export default function Home() {
  const me = useMe();
  const router = useRouter();
  const voice = useRef<VoiceHandle>(null);
  const slot = useRef<HTMLDivElement>(null);
  const chipsRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const mounted = useRef(true);
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [zoneTop, setZoneTop] = useState<number | null>(null);
  const [q, setQ] = useState("");
  const [searching, setSearching] = useState(false);
  const box = useRef<HTMLInputElement>(null);
  useEffect(() => { if (searching) box.current?.focus(); }, [searching]);
  const [live, setLive] = useState(false);
  const prompts = useMemo(() => timePrompts(me.profile), [me.profile]);
  const first = me.name?.split(" ")[0];

  useEffect(() => {
    mounted.current = true;
    const load = () => store.entries().then(setEntries);
    load();
    window.addEventListener("mindly:entry", load);
    return () => { mounted.current = false; window.removeEventListener("mindly:entry", load); };
  }, []);

  // The entries zone starts 50% of the way down the screen, or 28px under the prompts if they reach lower.
  // It depends only on the stage, never on the entries, so adding journals can't move anything above it.
  useLayoutEffect(() => {
    const chips = chipsRef.current, main = mainRef.current;
    if (!chips || !main) return;
    const measure = () => setZoneTop(Math.max(chips.getBoundingClientRect().bottom + 28, innerHeight * 0.5) - main.getBoundingClientRect().top);
    measure();
    const watcher = new ResizeObserver(measure);
    watcher.observe(chips);
    window.addEventListener("resize", measure);
    document.fonts?.ready.then(measure);
    return () => { watcher.disconnect(); window.removeEventListener("resize", measure); };
  }, [prompts]);

  // The entry is created only once there is something to put in it, so there's never a blank page to look at.
  const onRecording = async (rec: Recording, prompt: string | null) => {
    const e = await store.newEntry(prompt);
    await pipeline.addRecording(e.id, rec);
    if (mounted.current) router.push(`/entry/?id=${e.id}`);
  };

  const real = (entries ?? []).filter((e) => e.body.trim() || e.title || e.segments.length); // never show an empty shell
  const shown = real.filter((e) => matches(e, q, plain));
  // Hidden until the journal has loaded and the zone is placed, so nothing jumps on arrival.
  const ready = entries !== null && zoneTop !== null;

  return (
    <main ref={mainRef} className={`screen home${live ? " live" : ""}`} style={ready ? undefined : { visibility: "hidden" }}>
      <div className="recede stage-top">
        <AppHeader className="home-head" />

        <TrialCard />

        <div className="stage-body">
          <div className="stage-above hello">
            <h1 className="large-title">
              {salutation()}{first && <>, <span className="name">{first}<span className="underline"><Underline /></span></span></>}
            </h1>
          </div>

          <div className="orb-slot" ref={slot} aria-hidden="true" />

          <div className="stage-below">
            <p className="tap">Tap to talk</p>
            <div className="chips" ref={chipsRef}>
              {prompts.map((p) => <button key={p} className="chip small" onClick={() => voice.current?.start({ prompt: p })}>{p}</button>)}
            </div>
          </div>
        </div>
      </div>

      <div className="entries-zone recede" style={{ top: zoneTop ?? undefined }} role="region" aria-label="Your entries">
        <FirstWeek entries={entries ?? []} />
        {real.length === 0 && <><p className="empty-note">Your entries will gather here.</p></>}
        {searching && <div className="search"><Icon name="search" /><input ref={box} className="input" type="search" placeholder="Search your words" aria-label="Search your journal" value={q} onChange={(e) => setQ(e.target.value)} /></div>}
        {real.length > 0 && shown.length === 0 && <p className="empty-note">Nothing matches &ldquo;{q}&rdquo;.</p>}
        <EntryList entries={shown} headRight={real.length >= SEARCH_FROM && (
          <button className="icon-btn" aria-label={searching ? "Close search" : "Search your journal"} onClick={() => { setSearching((v) => !v); if (searching) setQ(""); }}><Icon name={searching ? "close" : "search"} /></button>
        )} />
      </div>

      {!live && <DueReminders />}

      <VoiceDock ref={voice} anchor={slot} onRecording={onRecording} onLive={setLive} hint="" />
    </main>
  );
}
