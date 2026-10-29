"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/Icon";
import { Orb } from "@/components/Orb";
import { useMe, useSession } from "@/components/Session";
import { useUI } from "@/components/UI";
import { api } from "@/lib/api";
import { GOALS, LANGUAGES } from "@/lib/content";
import * as pipeline from "@/lib/pipeline";
import type { User } from "@/lib/types";

const STEPS = ["name", "goals", "languages", "privacy", "mic"] as const;

export default function Onboarding() {
  const me = useMe();
  const { setMe } = useSession();
  const { toast } = useUI();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [name, setName] = useState(me.name || "");
  const [goals, setGoals] = useState<string[]>([]);
  const [langs, setLangs] = useState<string[]>(["en"]);
  const [consent, setConsent] = useState(false);
  const s = STEPS[step];

  const toggle = (list: string[], set: (v: string[]) => void, k: string) => set(list.includes(k) ? list.filter((x) => x !== k) : [...list, k]);

  const next = async (primary: boolean) => {
    if (s === "mic" && primary) {
      try { (await navigator.mediaDevices.getUserMedia({ audio: true })).getTracks().forEach((t) => t.stop()); }
      catch { toast("No problem. Mindly will ask again the first time you record."); }
    }
    if (step < STEPS.length - 1) return setStep(step + 1);
    const speechLanguage = langs.includes("en") || langs.includes("pcm") ? "" : langs.includes("yo") ? "yo" : langs.includes("ha") ? "ha" : "";
    try {
      const user = await api<User>("/api/me", { method: "PUT", json: {
        name, profile: { ...me.profile, goals, languages: langs, speechLanguage, onboarded: true, consentedAt: new Date().toISOString() } } });
      pipeline.setLanguage(speechLanguage);
      setMe(user);
      router.replace("/");
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

        {s === "languages" && <>
          <h1 className="title q">What languages do you think in?</h1>
          {LANGUAGES.map(([k, label]) => <Option key={k} on={langs.includes(k)} label={label} onClick={() => toggle(langs, setLangs, k)} />)}
          <p className="footnote">Speech works best in English, including Nigerian English, and with short Pidgin phrases. Yoruba and Hausa are experimental, and Igbo isn&apos;t supported yet. You can always edit the text.</p>
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

        {s === "mic" && <>
          <div style={{ width: 200, height: 200, margin: "8vh auto 0" }}><Orb idle={1.5} /></div>
          <h1 className="title q" style={{ textAlign: "center", marginTop: 16 }}>One last thing</h1>
          <p className="subhead" style={{ textAlign: "center" }}>Mindly needs your microphone to hear you. It only listens while the orb is open.</p>
        </>}

        <div className="foot">
          {step > 0 ? <button className="icon-btn" aria-label="Back" onClick={() => setStep(step - 1)}><Icon name="back" /></button> : <span />}
          <button className="next" aria-label={s === "mic" ? "Allow microphone and finish" : "Continue"} disabled={s === "privacy" && !consent} onClick={() => next(true)}>
            <Icon name="chev" />
          </button>
        </div>
      </section>
    </main>
  );
}
