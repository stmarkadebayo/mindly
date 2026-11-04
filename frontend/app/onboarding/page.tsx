"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { Orb } from "@/components/Orb";
import { useMe, useSession } from "@/components/Session";
import { useUI } from "@/components/UI";
import { api } from "@/lib/api";
import { progress, type Progress } from "@/lib/level";
import { enableReminder } from "@/lib/reminder";
import { GOALS } from "@/lib/content";
import * as pipeline from "@/lib/pipeline";
import { MicDeniedError, Recorder } from "@/lib/recorder";
import * as store from "@/lib/store";
import type { User } from "@/lib/types";

const STEPS = ["name", "goals", "privacy", "voice", "done"] as const;

export default function Onboarding() {
  const me = useMe();
  const { setMe, config } = useSession();
  const { toast } = useUI();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [name, setName] = useState(me.name || "");
  const [goals, setGoals] = useState<string[]>([]);
  const [consent, setConsent] = useState(false);
  const s = STEPS[step];

  // The last step: say a few words so Mindly can tune in. It is a real first entry, so the first page is waiting afterwards.
  const [phase, setPhase] = useState<"idle" | "listening" | "working" | "heard">("idle");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [heard, setHeard] = useState("");
  const [denied, setDenied] = useState(false);      // no microphone: offer to type the first page instead
  const [typed, setTyped] = useState("");
  const [wasTyped, setWasTyped] = useState(false);
  const [level, setLevel] = useState<Progress | null>(null);
  const [remindAt, setRemindAt] = useState("20:00");
  const rec = useRef<Recorder | null>(null);
  const first = useRef<string | null>(null);

  useEffect(() => {
    const onEntry = async (ev: Event) => {
      const d = (ev as CustomEvent<pipeline.EntryEvent>).detail;
      if (d.entryId !== first.current) return;
      const seg = (await store.entry(d.entryId))?.segments[0];
      if (seg?.transcript) { setHeard(seg.transcript); setPhase("heard"); }
      else if (seg && ["no_speech", "failed"].includes(seg.status)) { toast("I couldn't make that out. Try once more?"); setPhase("idle"); }
    };
    window.addEventListener("mindly:entry", onEntry);
    return () => window.removeEventListener("mindly:entry", onEntry);
  }, [toast]);

  const talk = async () => {
    if (phase === "listening") {
      const r = await rec.current?.stop(true);
      rec.current = null;
      setStream(null);
      if (!r || r.seconds < 2) { toast("That was very short. Say a sentence or two."); return setPhase("idle"); }
      setPhase("working");
      const e = await store.newEntry();
      first.current = e.id;
      await pipeline.addRecording(e.id, r);
      return;
    }
    if (phase !== "idle") return;
    const r = new Recorder({ onAutoStop: () => talk() });
    try { setStream(await r.start()); rec.current = r; setPhase("listening"); }
    catch (err) { setDenied(true); toast(err instanceof MicDeniedError ? "No problem. You can allow the microphone later, or type instead." : (err as Error).message); }
  };

  const saveTyped = async () => {
    const text = typed.trim();
    if (!text) return;
    const e = await store.newEntry();
    await store.updateEntry(e.id, (x) => { x.body = text; });
    first.current = e.id; setHeard(text); setWasTyped(true); setPhase("heard");
  };

  const toggle = (list: string[], set: (v: string[]) => void, k: string) => set(list.includes(k) ? list.filter((x) => x !== k) : [...list, k]);

  const finish = async () => {
    try {
      const user = await api<User>("/api/me", { method: "PUT", json: {
        name, profile: { ...me.profile, goals, onboarded: true, consentedAt: new Date().toISOString() } } });
      setMe(user);
      router.replace(first.current ? `/entry/?id=${first.current}` : "/");
    } catch (e) { toast((e as Error).message); }
  };

  const next = async () => {
    if (rec.current) { await rec.current.stop(false); rec.current = null; setStream(null); }
    // Skipping the voice step goes straight to Today, where a prompt is waiting.
    if (s === "voice" && !first.current) return finish();
    if (s === "voice") setLevel(progress(await store.entries()));
    if (step < STEPS.length - 1) return setStep(step + 1);
    finish();
  };

  const remind = async () => {
    try { await enableReminder(config.vapid_public_key!, remindAt); toast(`Reminder set for ${remindAt}`); }
    catch (e) { toast((e as Error).message); }
    finish();
  };

  const Option = ({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) => (
    <button className="option" aria-pressed={on} onClick={onClick}>{label}<span className="tick"><Icon name="check" /></span></button>
  );

  return (
    <main className="screen onboarding">
      <section className="onboard">
        <div className="progress" aria-label={`Step ${step + 1} of ${STEPS.length}`}>{STEPS.map((_, i) => <span key={i} className={i <= step ? "on" : ""} />)}</div>

        {s === "name" && <>
          <h1 className="title q">What should we call you?</h1>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="First name" autoComplete="given-name" autoFocus />
        </>}

        {s === "goals" && <>
          <h1 className="title q">What brings you to Mindly?</h1>
          <p className="subhead" style={{ marginTop: -12 }}>Pick any. Mindly suggests prompts that fit.</p>
          {GOALS.map(([k, label]) => <Option key={k} on={goals.includes(k)} label={label} onClick={() => toggle(goals, setGoals, k)} />)}
        </>}

        {s === "privacy" && <>
          <h1 className="title q">Before you start</h1>
          <ul className="facts">
            <li><span className="ic"><Icon name="device" /></span><div><b>Your journal stays on this device.</b><div className="subhead">Pages and recordings are saved in this browser, not on our servers.</div></div></li>
            <li><span className="ic"><Icon name="spark" /></span><div><b>AI turns your voice into pages.</b><div className="subhead">Audio passes through our server to open AI models. We keep none of it and never train on it.</div></div></li>
            <li><span className="ic"><Icon name="heart" /></span><div><b>Mindly isn&apos;t therapy.</b><div className="subhead">If you&apos;re in danger, call 112.</div></div></li>
          </ul>
          <label className="consent"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>I agree to the <a href="/terms/" target="_blank">terms</a>.</span></label>
        </>}

        {s === "voice" && <>
          <button className="orb-btn" onClick={talk}
            aria-label={phase === "listening" ? "Stop" : "Start talking"}><Orb stream={stream} thinking={phase === "working"} idle={1.5} pad={1.7} /></button>
          <div className="orb-gap" />
          <h1 className="title q" style={{ textAlign: "center", marginTop: 0 }}>
            {phase === "listening" ? "I'm listening" : phase === "working" ? "Getting used to your voice…" : phase === "heard" ? "Nice to meet you" : "Say a few words"}
          </h1>
          <p className="subhead" style={{ textAlign: "center" }}>
            {phase === "idle" && "Tap the orb and tell me how your day is going. This becomes your first page."}
            {phase === "listening" && "Tap the orb again when you're done."}
            {phase === "working" && "Listening back…"}
            {phase === "heard" && <>{wasTyped ? "Saved as your first page: " : "Here\u2019s what I heard: "}<i>{heard}</i></>}
          </p>
          {phase === "idle" && <p className="footnote" style={{ textAlign: "center", margin: "6px 0 0" }}>Your browser will ask to use the microphone. It only listens while you record.</p>}
          {denied && phase === "idle" && <>
            <textarea className="input ob-type" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Type a few lines about your day" aria-label="Your first page" />
            <button className="btn btn-primary" style={{ display: "block", margin: "8px auto 0" }} disabled={!typed.trim()} onClick={saveTyped}>Save my first page</button>
          </>}
          {phase !== "heard" && <button className="btn btn-plain" style={{ display: "block", margin: "8px auto 0" }} onClick={next}>Skip for now</button>}
        </>}

        {s === "done" && <>
          <h1 className="title q" style={{ textAlign: "center" }}>Your first page is written</h1>
          {level && <div className="ob-level">
            <b>{level.name}</b>
            <div className="level-bar" aria-hidden="true"><i style={{ width: `${Math.max(4, level.pct * 100)}%` }} /></div>
            <small>{level.score} {level.score === 1 ? "point" : "points"}{level.next ? `. ${level.next.at - level.score} more to reach ${level.next.name}.` : "."}</small>
          </div>}
          {config.vapid_public_key
            ? <>
                <p className="subhead" style={{ textAlign: "center" }}>Want a nudge tomorrow? Pick a time. Writing again starts your streak.</p>
                <div className="ob-remind">
                  <input className="input" type="time" value={remindAt} onChange={(e) => setRemindAt(e.target.value)} aria-label="Reminder time" />
                  <button className="btn btn-primary" onClick={remind}>Remind me</button>
                </div>
                <button className="btn btn-plain" style={{ display: "block", margin: "8px auto 0" }} onClick={finish}>Not now</button>
              </>
            : <p className="subhead" style={{ textAlign: "center" }}>Come back tomorrow to start a streak.</p>}
        </>}

        <div className="foot">
          {step > 0 ? <button className="icon-btn" aria-label="Back" onClick={() => setStep(step - 1)}><Icon name="back" /></button> : <span />}
          <button className="next" aria-label={s === "done" ? "Finish" : "Continue"} disabled={(s === "privacy" && !consent) || (s === "voice" && phase !== "heard")} onClick={next}>
            <Icon name="chev" />
          </button>
        </div>
      </section>
    </main>
  );
}
