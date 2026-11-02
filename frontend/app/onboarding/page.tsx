"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { Orb } from "@/components/Orb";
import { useMe, useSession } from "@/components/Session";
import { useUI } from "@/components/UI";
import { api } from "@/lib/api";
import { GOALS } from "@/lib/content";
import * as pipeline from "@/lib/pipeline";
import { MicDeniedError, Recorder } from "@/lib/recorder";
import * as store from "@/lib/store";
import type { User } from "@/lib/types";

const STEPS = ["name", "goals", "privacy", "voice"] as const;

export default function Onboarding() {
  const me = useMe();
  const { setMe } = useSession();
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
    catch (err) { toast(err instanceof MicDeniedError ? "No problem. You can allow the microphone later." : (err as Error).message); }
  };

  const toggle = (list: string[], set: (v: string[]) => void, k: string) => set(list.includes(k) ? list.filter((x) => x !== k) : [...list, k]);

  const next = async (primary: boolean) => {
    if (rec.current) { await rec.current.stop(false); rec.current = null; setStream(null); }
    if (step < STEPS.length - 1) return setStep(step + 1);
    const speechLanguage = ""; // auto-detect: people mix English, Pidgin and Yoruba, so we don't make them choose
    try {
      const user = await api<User>("/api/me", { method: "PUT", json: {
        name, profile: { ...me.profile, goals, speechLanguage, onboarded: true, consentedAt: new Date().toISOString() } } });
      pipeline.setLanguage(speechLanguage);
      setMe(user);
      router.replace(first.current ? `/entry/?id=${first.current}` : "/");
    } catch (e) { toast((e as Error).message); }
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
            <li><span className="ic"><Icon name="device" /></span><div><b>Your journal lives on this device.</b><div className="subhead">Recordings and pages are saved in this browser, not on Mindly&apos;s servers.</div></div></li>
            <li><span className="ic"><Icon name="spark" /></span><div><b>AI helps when you record or talk.</b><div className="subhead">Your audio goes through our server to an open speech model that turns it into text, then an open AI model writes your page or replies. Mindly keeps none of it and never uses it for training. The model hosts process it under their own terms.</div></div></li>
            <li><span className="ic"><Icon name="heart" /></span><div><b>Mindly isn&apos;t therapy.</b><div className="subhead">It&apos;s a journal with a thoughtful companion, not a medical or crisis service. If you&apos;re in danger, call 112.</div></div></li>
            <li><span className="ic"><Icon name="mic" /></span><div><b>Record only yourself, within the model licences.</b><div className="subhead">Don&apos;t transcribe other people without their consent. Mindly&apos;s open models (Whisper, Gemma) come with licences and usage rules you agree to follow.</div></div></li>
          </ul>
          <label className="consent"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>I understand how Mindly handles my data, it isn&apos;t a substitute for professional help, and I agree to the <a href="/terms/" target="_blank">terms</a>, including the model licences and recording only myself.</span></label>
        </>}

        {s === "voice" && <>
          <button className="orb-btn" style={{ width: 200, height: 200, margin: "6vh auto 0", display: "block" }} onClick={talk}
            aria-label={phase === "listening" ? "Stop" : "Start talking"}><Orb stream={stream} thinking={phase === "working"} idle={1.5} /></button>
          <h1 className="title q" style={{ textAlign: "center", marginTop: 16 }}>
            {phase === "listening" ? "I'm listening" : phase === "working" ? "Getting used to your voice…" : phase === "heard" ? "Nice to meet you" : "Say a few words"}
          </h1>
          <p className="subhead" style={{ textAlign: "center" }}>
            {phase === "idle" && "Tap the orb and tell me how your day is going, so I can get used to how you speak. This becomes your first page."}
            {phase === "listening" && "Tap the orb again when you're done."}
            {phase === "working" && "Listening back…"}
            {phase === "heard" && <>Here&apos;s what I heard: <i>{heard}</i></>}
          </p>
          {phase !== "heard" && <button className="btn btn-plain" style={{ display: "block", margin: "8px auto 0" }} onClick={() => next(false)}>Skip for now</button>}
        </>}

        <div className="foot">
          {step > 0 ? <button className="icon-btn" aria-label="Back" onClick={() => setStep(step - 1)}><Icon name="back" /></button> : <span />}
          <button className="next" aria-label={s === "voice" ? "Finish" : "Continue"} disabled={(s === "privacy" && !consent) || (s === "voice" && phase !== "heard")} onClick={() => next(true)}>
            <Icon name="chev" />
          </button>
        </div>
      </section>
    </main>
  );
}
