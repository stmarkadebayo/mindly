"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useMe } from "@/components/Session";
import { api } from "@/lib/api";
import { plain } from "@/lib/text";
import { TopBar } from "@/components/Bits";
import { MOODS, moodColor } from "@/lib/content";
import * as store from "@/lib/store";
import type { Entry } from "@/lib/types";

interface Ai { headline: string; themes: { label: string; ids: string[] }[]; noticed: { text: string; ids: string[] }[]; try: string }

/** What the AI found in your recent entries. Cached on this device until the entries change, so it costs one call, not one per visit. */
function AiInsights({ all }: { all: Entry[] }) {
  const me = useMe();
  const written = all.filter((e) => plain(e.body)).slice(0, 30);
  const sig = written.map((e) => e.id + e.updated).join("|");
  const cacheKey = `mindly-insights-${me.id}`;
  const [data, setData] = useState<Ai | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const run = useCallback(async () => {
    setBusy(true); setError("");
    try {
      const res = await api<Ai>("/api/insights", { method: "POST", json: {
        entries: written.map((e) => ({ id: e.id, created: e.created, title: e.title, body: plain(e.body).slice(0, 900) })) } });
      setData(res);
      try { localStorage.setItem(cacheKey, JSON.stringify({ sig, res })); } catch { /* not cached */ }
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't read your entries."); }
    setBusy(false);
  }, [sig]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (written.length < 3) return;
    try { const c = JSON.parse(localStorage.getItem(cacheKey) || "null"); if (c?.sig === sig) { setData(c.res); return; } } catch { /* run fresh */ }
    run();
  }, [sig]); // eslint-disable-line react-hooks/exhaustive-deps

  const open = (ids: string[]) => ids[0] ? `/entry/?id=${ids[0]}` : "";
  return (
    <section className="ai-insights">
      <div className="ai-head">
        <p className="headline" style={{ margin: 0 }}>From your words</p>
        {written.length >= 3 && <button className="btn btn-plain" onClick={run} disabled={busy}>{busy ? "Reading…" : "Refresh"}</button>}
      </div>
      {written.length < 3 && <p className="footnote">Write three entries and Mindly will start noticing what keeps coming up.</p>}
      {error && <p className="footnote">{error}</p>}
      {busy && !data && <p className="footnote">Reading your entries…</p>}
      {data && <>
        <p className="hand ai-lead">{data.headline}</p>
        {!!data.themes.length && <div className="chips" style={{ justifyContent: "flex-start" }}>
          {data.themes.map((t) => <Link key={t.label} className="chip small" href={open(t.ids)}>{t.label} · {t.ids.length}</Link>)}
        </div>}
        <div className="group">
          {data.noticed.map((n) => (
            <Link key={n.text} className="row" href={open(n.ids) || "#"}><span className="grow"><span className="x" style={{ whiteSpace: "normal" }}>{n.text}</span></span></Link>
          ))}
          {data.try && <div className="row"><span className="grow"><span className="footnote">Something to try</span><span className="t" style={{ display: "block", fontWeight: 400 }}>{data.try}</span></span></div>}
        </div>
      </>}
    </section>
  );
}

const W = 280, H = 96, PAD = 10;

export default function Insights() {
  const [all, setAll] = useState<Entry[] | null>(null);
  useEffect(() => { store.entries().then(setAll); }, []);
  if (!all) return <main className="screen" />;

  const now = Date.now();
  const recent = all.filter((e) => new Date(e.created).getTime() >= now - 30 * 864e5);
  const days = new Set(recent.map((e) => new Date(e.created).toDateString())).size;
  const words = all.reduce((n, e) => n + (plain(e.body).match(/\S+/g)?.length || 0), 0);

  // One point per day, centred in its column so the weekday letters below line up.
  const points = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(now - (13 - i) * 864e5);
    const moods = all.filter((e) => e.mood && new Date(e.created).toDateString() === d.toDateString()).map((e) => e.mood!);
    const avg = moods.length ? moods.reduce((a, b) => a + b, 0) / moods.length : 0;
    return { d, avg, x: (i + 0.5) * (W / 14), y: avg ? H - PAD - ((avg - 1) / 4) * (H - 2 * PAD) : 0 };
  });
  const filled = points.filter((p) => p.avg);
  const path = filled.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const levelY = (v: number) => H - PAD - ((v - 1) / 4) * (H - 2 * PAD);

  return (
    <main className="screen">
      <TopBar back="/" title="Insights" />
      <div className="stats">
        <div className="stat"><b>{recent.length}</b><span>entries this month</span></div>
        <div className="stat"><b>{days}</b><span>days you wrote</span></div>
        <div className="stat"><b>{words.toLocaleString()}</b><span>words so far</span></div>
      </div>

      <AiInsights all={all} />

      <section className="chart">
        <p className="headline" style={{ margin: 0 }}>Mood, last two weeks</p>
        <p className="footnote" style={{ margin: "2px 0 0" }}>{filled.length ? "From the mood you picked after recording." : "Pick a mood after you record, and it shows up here."}</p>
        <svg className="line-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Mood over the last 14 days">
          {[1, 3, 5].map((v) => <line key={v} x1={0} x2={W} y1={levelY(v)} y2={levelY(v)} stroke="var(--hairline)" strokeWidth="0.5" />)}
          {filled.length > 1 && <path d={path} fill="none" stroke="var(--ink-2)" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />}
          {filled.map((p) => (
            <circle key={p.d.toISOString()} cx={p.x} cy={p.y} r="4" fill={moodColor(Math.round(p.avg))}>
              <title>{`${p.d.toDateString()}: ${MOODS[Math.round(p.avg) - 1].label}`}</title>
            </circle>
          ))}
        </svg>
        <div className="axis">{points.map((p) => <span key={p.d.toISOString()}>{p.d.toLocaleDateString(undefined, { weekday: "narrow" })}</span>)}</div>
      </section>

      <p className="hand" style={{ fontSize: 18, color: "var(--muted)", marginTop: 24 }}>No streaks here, on purpose. Come back whenever it helps.</p>
    </main>
  );
}
