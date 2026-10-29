"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Mark, Underline } from "@/components/Hand";
import { Icon } from "@/components/Icon";
import { useMe } from "@/components/Session";
import { VoiceDock, type VoiceHandle } from "@/components/VoiceDock";
import { dayLabel, defaultPrompts, moodColor, salutation, timeLabel } from "@/lib/content";
import * as pipeline from "@/lib/pipeline";
import type { Recording } from "@/lib/recorder";
import * as store from "@/lib/store";
import { excerpt, plain } from "@/lib/text";
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
  const [live, setLive] = useState(false);
  const prompts = useMemo(() => defaultPrompts(me.profile), [me.profile]);
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
  const shown = real.filter((e) => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    return words.every((w) => `${e.title} ${plain(e.body)} ${e.prompt ?? ""}`.toLowerCase().includes(w));
  });
  const groups: [string, Entry[]][] = [];
  for (const e of shown) {
    const label = dayLabel(e.created);
    if (groups.at(-1)?.[0] !== label) groups.push([label, []]);
    groups.at(-1)![1].push(e);
  }

  // Hidden until the journal has loaded and the zone is placed, so nothing jumps on arrival.
  const ready = entries !== null && zoneTop !== null;

  return (
    <main ref={mainRef} className={`screen home${live ? " live" : ""}`} style={ready ? undefined : { visibility: "hidden" }}>
      <div className="recede stage-top">
        <header className="home-head">
          <Mark size={28} />
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <Link className="icon-btn" href="/insights/" aria-label="Insights"><Icon name="chart" /></Link>
            <Link className="avatar" href="/settings/" aria-label="Settings">{(me.name || me.email)[0].toUpperCase()}</Link>
          </div>
        </header>

        <div className="stage-body">
          <div className="stage-above hello">
            <h1 className="large-title">
              {salutation()}{first && <>, <span className="name">{first}<span className="underline"><Underline /></span></span></>}
            </h1>
          </div>

          <div className="orb-slot" ref={slot} aria-hidden="true" />

          <div className="stage-below">
            <p className="tap">Tap to talk</p>
            <p className="stage-or">or begin with a prompt</p>
            <div className="chips" ref={chipsRef}>
              {prompts.map((p) => <button key={p} className="chip small" onClick={() => voice.current?.start({ prompt: p })}>{p}</button>)}
            </div>
          </div>
        </div>
      </div>

      <div className="entries-zone recede" style={{ top: zoneTop ?? undefined }} role="region" aria-label="Your entries">
        {real.length === 0 && <p className="empty-note">Your entries will gather here.</p>}
        {real.length >= SEARCH_FROM && (
          <div className="search"><Icon name="search" /><input className="input" type="search" placeholder="Search your journal" aria-label="Search your journal" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        )}
        {real.length > 0 && groups.length === 0 && <p className="empty-note">Nothing matches &ldquo;{q}&rdquo;.</p>}
        {groups.map(([label, list]) => (
          <section key={label}>
            <h2 className="section-label">{label}</h2>
            <div className="group">
              {list.map((e) => {
                const pending = e.segments.some((s) => ["saved", "transcribing", "writing", "queued"].includes(s.status));
                const failed = e.segments.some((s) => s.status === "failed");
                const silent = !e.body.trim() && !e.title && e.segments.length > 0 && e.segments.every((s) => s.status === "no_speech");
                return (
                  <Link key={e.id} className="row entry-row" href={`/entry/?id=${e.id}`}>
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
      </div>

      <Link className="chat-pill glass chrome" href="/talk/" aria-label="Chat with Mindly"><Mark size={22} />Chat</Link>

      <VoiceDock ref={voice} anchor={slot} onRecording={onRecording} onLive={setLive} hint="" />
    </main>
  );
}
