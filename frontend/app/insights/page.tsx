"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useMe } from "@/components/Session";
import { cached, enough, refresh, reject, rejected, type Ai } from "@/lib/insights";
import { plain } from "@/lib/text";
import { Underline } from "@/components/Hand";
import { LevelBody } from "@/components/Level";
import { progress } from "@/lib/level";
import { MOODS, moodColor } from "@/lib/content";
import * as store from "@/lib/store";
import type { Entry } from "@/lib/types";

/** What the AI found in your recent entries. It is prepared in the background (see lib/insights.ts); this only shows it. */
function AiInsights({ all }: { all: Entry[] }) {
  const me = useMe();
  const [data, setData] = useState<Ai | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [hidden, setHidden] = useState<string[]>([]);
  const ready = enough(all);
  useEffect(() => { setHidden(rejected(me.id)); }, [me.id]);

  const run = useCallback(async () => {
    setBusy(true); setError("");
    try { setData(await refresh(me.id, all)); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn't read your entries."); }
    setBusy(false);
  }, [me.id, all]);

  useEffect(() => {
    if (!ready) return;
    const saved = cached(me.id);
    if (saved) setData(saved); else run();   // normally the saved one is already there; this covers a first visit with the app just opened
    const sync = () => { const c = cached(me.id); if (c) setData(c); };
    window.addEventListener("mindly:insights", sync);
    return () => window.removeEventListener("mindly:insights", sync);
  }, [ready, all]); // eslint-disable-line react-hooks/exhaustive-deps

  // One entry opens it; several open the Journal showing just the entries behind that theme or observation.
  const open = (ids: string[], label: string) => ids.length === 1 ? `/entry/?id=${ids[0]}` : ids.length ? `/journal/?ids=${ids.join(",")}&label=${encodeURIComponent(label)}` : "";
  return (
    <section className="ai-insights">
      <div className="ai-head">
        <p className="headline" style={{ margin: 0 }}>From your words</p>
      </div>
      {!ready && <p className="footnote">Write three entries and Mindly will start noticing what keeps coming up.</p>}
      {error && <p className="footnote">{error}</p>}
      {busy && !data && <p className="footnote">Reading your entries…</p>}
      {data && <>
        <p className="hand ai-lead">{data.headline}</p>
        {!!data.themes.length && <div className="chips" style={{ justifyContent: "flex-start" }}>
          {data.themes.map((t) => <Link key={t.label} className="chip small" href={open(t.ids, t.label)}>{t.label} · {t.ids.length}</Link>)}
        </div>}
        <div className="group">
          {data.noticed.filter((n) => !hidden.includes(n.text)).map((n) => {
            const text = n.text.replace(/\s*\[\d+(?:,\s*\d+)*\]/g, "");
            return (
              <div key={n.text} className="row insight-row">
                <Link className="grow" href={open(n.ids, text) || "#"} style={{ textDecoration: "none" }}>
                  <span className="x" style={{ whiteSpace: "normal" }}>{text}</span>
                  {n.ids.length > 0 && <span className="footnote" style={{ display: "block" }}>from {n.ids.length} {n.ids.length === 1 ? "entry" : "entries"}</span>}
                </Link>
                <button className="btn btn-plain unsure" onClick={() => { reject(me.id, n.text); setHidden((h) => [...h, n.text]); }}>Not quite right</button>
              </div>
            );
          })}
          {data.try && <div className="row"><span className="grow"><span className="footnote">A question to sit with</span><span className="t" style={{ display: "block", fontWeight: 400 }}>{data.try}</span></span></div>}
        </div>
      </>}
    </section>
  );
}

/** Where your journal level stands, with a way into the full picture. */
function LevelCard({ all }: { all: Entry[] }) {
  const [open, setOpen] = useState(false);
  const p = progress(all);
  return (
    <div className="level-card-wrap">
      <button className="level-card" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="lc-top"><span className="lc-name"><small>Journal level</small><b>{p.name}</b></span>
          <span className="lc-next">{p.next ? `${p.next.at - p.score} to ${p.next.name}` : "Top level"}</span></span>
        <span className="level-card-bar" aria-hidden="true"><i style={{ width: `${Math.max(6, p.pct * 100)}%` }} /></span>
      </button>
      {open && <div className="level-card-body"><LevelBody p={p} /></div>}
    </div>
  );
}

/** This month as a page of days: each day you wrote is a dot in that day's mood colour. */
function MonthPage({ all }: { all: Entry[] }) {
  const today = new Date();
  const y = today.getFullYear(), m = today.getMonth();
  const inMonth = all.filter((e) => { const d = new Date(e.created); return d.getFullYear() === y && d.getMonth() === m; });
  const byDay = new Map<number, Entry[]>();
  inMonth.forEach((e) => { const d = new Date(e.created).getDate(); byDay.set(d, [...(byDay.get(d) ?? []), e]); });
  const words = inMonth.reduce((n, e) => n + (plain(e.body).match(/\S+/g)?.length || 0), 0);
  const length = new Date(y, m + 1, 0).getDate();
  const lead = (new Date(y, m, 1).getDay() + 6) % 7;   // Monday first
  const days = byDay.size;
  return (
    <section className="month" aria-label="This month">
      <p className="month-lead">
        {days ? <>You wrote on <span className="name">{days} {days === 1 ? "day" : "days"}<span className="underline"><Underline /></span></span> this month.</> : <>A fresh page for {today.toLocaleDateString(undefined, { month: "long" })}.</>}
      </p>
      {days > 0 && <p className="month-sub">{inMonth.length} {inMonth.length === 1 ? "entry" : "entries"} · {words.toLocaleString()} words</p>}
      <div className="month-grid" role="img" aria-label={`${days} of ${length} days written`}>
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => <span key={i} className="dow">{d}</span>)}
        {Array.from({ length: lead }, (_, i) => <i key={`b${i}`} />)}
        {Array.from({ length }, (_, i) => {
          const day = i + 1, list = byDay.get(day);
          const moods = (list ?? []).map((e) => e.mood).filter((v): v is number => !!v);
          const color = moods.length ? moodColor(Math.round(moods.reduce((a, b) => a + b, 0) / moods.length)) : "var(--lavender)";
          return <b key={day} className={`${list ? "on" : ""}${day === today.getDate() ? " today" : ""}`} style={list ? { background: color } : undefined}
            title={list ? `${list.length} ${list.length === 1 ? "entry" : "entries"}` : undefined}>{day}</b>;
        })}
      </div>
    </section>
  );
}

const W = 280, H = 96, PAD = 10;

export default function Insights() {
  const [all, setAll] = useState<Entry[] | null>(null);
  useEffect(() => { store.entries().then(setAll); }, []);
  if (!all) return <main className="screen" />;

  const now = Date.now();

  // One point per day, centred in its column so the weekday letters below line up.
  const points = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(now - (13 - i) * 864e5);
    const moods = all.filter((e) => e.mood && new Date(e.created).toDateString() === d.toDateString()).map((e) => e.mood!);
    const avg = moods.length ? moods.reduce((a, b) => a + b, 0) / moods.length : 0;
    return { d, avg, x: (i + 0.5) * (W / 14), y: avg ? H - PAD - ((avg - 1) / 4) * (H - 2 * PAD) : 0 };
  });
  const filled = points.filter((p) => p.avg);
  // A line between two days is solid when they are neighbours, and a faint dash across a missed day.
  const links = filled.slice(1).map((p, i) => {
    const a = filled[i];
    return { key: p.d.toISOString(), d: `M${a.x.toFixed(1)} ${a.y.toFixed(1)} L${p.x.toFixed(1)} ${p.y.toFixed(1)}`, gap: points.indexOf(p) - points.indexOf(a) > 1 };
  });
  const levelY = (v: number) => H - PAD - ((v - 1) / 4) * (H - 2 * PAD);

  return (
    <main className="screen journal">
      <header className="journal-head"><h1 className="large-title"><span className="name">Insights<span className="underline"><Underline /></span></span></h1></header>
      <MonthPage all={all} />
      <LevelCard all={all} />

      <AiInsights all={all} />

      <section className="chart">
        <p className="headline" style={{ margin: 0 }}>Mood, last two weeks</p>
        <p className="footnote" style={{ margin: "2px 0 0" }}>{filled.length ? "From the mood you picked after recording." : "Pick a mood after you record, and it shows up here."}</p>
        <div className="chart-grid">
          <div className="y-labels" aria-hidden>
            {[5, 3, 1].map((v) => <span key={v} style={{ top: `${(levelY(v) / H) * 100}%` }}>{MOODS[v - 1].label}</span>)}
          </div>
          <svg className="line-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Mood over the last 14 days">
            {[1, 3, 5].map((v) => <line key={v} x1={0} x2={W} y1={levelY(v)} y2={levelY(v)} stroke="var(--hairline)" strokeWidth="0.5" />)}
            {links.map((l) => <path key={l.key} d={l.d} fill="none" stroke="var(--ink-2)" strokeLinecap="round"
              strokeWidth={l.gap ? 0.8 : 1} strokeOpacity={l.gap ? 0.25 : 0.5} strokeDasharray={l.gap ? "2 3" : undefined} />)}
            {filled.map((p) => (
              <circle key={p.d.toISOString()} cx={p.x} cy={p.y} r="4" fill={moodColor(Math.round(p.avg))}>
                <title>{`${p.d.toDateString()}: ${MOODS[Math.round(p.avg) - 1].label}`}</title>
              </circle>
            ))}
          </svg>
          <div className="axis">{points.map((p, i) => <span key={p.d.toISOString()} className={i === 13 ? "today" : undefined}>{p.d.getDate()}</span>)}</div>
        </div>
      </section>

    </main>
  );
}
