"use client";
// The landing page: the app shown working inside a phone (a ramble becoming a page), the four steps on one phone, what
// Mindly keeps (a receipt, not adjectives), plans, and one call to action. The same page on a phone and a desktop.
import Link from "next/link";
import { useEffect, useState } from "react";
import { Mark, Underline } from "@/components/Hand";
import { Icon } from "@/components/Icon";
import { Orb } from "@/components/Orb";
import { useSession } from "@/components/Session";
import { MOODS } from "@/lib/content";
import { usePricing } from "@/lib/pricing";

const REPO = "https://github.com/stmarkadebayo/mindly";
const HEARD = "um so today was busy… I finished the slides for Thursday, went to the gym, and uh I still need to call my mum tomorrow";

const still = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

export default function Welcome() {
  const { config } = useSession();
  const pricing = usePricing(config.prices);
  return (
    <main className="ld">
      <header className="ld-head">
        <span className="ld-brand"><Mark size={26} />mindly</span>
        <nav aria-label="Account">
          <Link href="/auth/?mode=signin">Sign in</Link>
          <Link className="btn btn-primary" href="/auth/?mode=signup">Get started</Link>
        </nav>
      </header>

      <section className="ld-hero">
        <div className="ld-copy">
          <h1>Talk it out.<br />Mindly keeps the <span className="name">page<span className="underline"><Underline /></span></span>.</h1>
          <p className="ld-lead">A private journal you speak to. Say what&apos;s on your mind, and get back a clear page in your own words.</p>
          <Link className="btn btn-primary ld-go" href="/auth/?mode=signup">Start your first page</Link>
          <p className="ld-trust">Your journal stays on your phone · 30 days of Pro free · No card</p>
        </div>
        <HeroPhone />
      </section>

      <Steps />

      <section className="ld-private" aria-labelledby="private">
        <div>
          <h2 id="private" className="ld-h">Your journal lives on your phone. Not on our servers.</h2>
          <p>Your pages and recordings are saved on your device. To write a page, the audio passes through open AI models and is gone once the page is written.</p>
          <ul className="ld-perks"><li><Icon name="lock" />PIN lock</li><li><Icon name="send" />Export any time</li><li><Icon name="close" />Wipe in one tap</li></ul>
        </div>
        <dl className="ld-receipt" aria-label="What Mindly keeps">
          <p className="ld-receipt-head">What Mindly keeps</p>
          <div><dt>Pages on our servers</dt><dd>0</dd></div>
          <div><dt>Recordings kept after writing</dt><dd>0</dd></div>
          <div><dt>Words used to train AI</dt><dd>0</dd></div>
          <div><dt>Ads</dt><dd>0</dd></div>
          <div className="total"><dt>Pages on your phone</dt><dd>all of them</dd></div>
        </dl>
      </section>

      <section className="ld-plans" aria-labelledby="plans">
        <h2 id="plans" className="ld-h">Start free. Stay if it helps.</h2>
        <div className="ld-plan-row">
          <div className="ld-plan">
            <p className="ld-plan-name">Free</p>
            <ul><li>{config.free_minutes ?? 10} minutes of speech a day</li><li>Unlimited typing and reading</li><li>Reflections and insights</li></ul>
          </div>
          <div className="ld-plan pro">
            <p className="ld-plan-name">Pro{pricing.label && <span>{pricing.label}</span>}</p>
            <ul><li>Unlimited speech</li><li>Room mode for voices across a room</li><li>Everything in Free</li></ul>
          </div>
        </div>
        <p className="ld-plan-note">Every new journal starts with 30 days of Pro, free. No card.</p>
      </section>

      <section className="ld-end" aria-label="Get started">
        <h2 className="ld-h">Start your first page.</h2>
        <Link className="btn btn-primary ld-go" href="/auth/?mode=signup">Get started</Link>
        <p className="ld-care">Mindly is a journal with a thoughtful companion, not therapy or a crisis service. If you&apos;re in danger, call 112.</p>
      </section>

      <footer className="ld-foot">
        <nav aria-label="About"><Link href="/privacy/">Privacy</Link><Link href="/terms/">Terms</Link><Link href="/support/">Need support?</Link></nav>
        <p>Built on open models (Whisper and Gemma). <a href={REPO} target="_blank" rel="noopener noreferrer">Open source on GitHub</a>. © 2026 Mindly</p>
      </footer>
    </main>
  );
}

/** A phone: frame, island and status bar around whatever screen it shows. */
function Phone({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className="ld-phone" role="img" aria-label={label}>
      <div className="ld-screen">
        <div className="ld-status" aria-hidden="true"><span>9:41</span><i className="ld-island" /><span className="ld-bars"><b /><b /><b /><b /></span></div>
        {children}
      </div>
    </div>
  );
}

/** The app's recording screen: the orb speaking, the clock running, the controls along the bottom. */
function Listening({ secs }: { secs: number }) {
  return (
    <div className="ld-app ld-live">
      <p className="ld-live-state">I&apos;m listening</p>
      <div className="ld-live-orb"><Orb voice idle={0.6} pad={1.7} /></div>
      <div className="ld-controls"><Icon name="close" /><span>0:{String(secs).padStart(2, "0")}</span><Icon name="pause" /><b><Icon name="check" /></b></div>
    </div>
  );
}

/** The hero loop: talk, tap done, the words land faded, then the written page and its reminder. One screen at a time. */
type Beat = "talk" | "heard" | "page";
function HeroPhone() {
  const [beat, setBeat] = useState<Beat>("page");
  const [secs, setSecs] = useState(14);
  useEffect(() => {
    if (still()) return;
    let alive = true, timer: ReturnType<typeof setTimeout>;
    const wait = (ms: number) => new Promise<void>((r) => { timer = setTimeout(r, ms); });
    (async () => {
      while (alive) {
        setBeat("talk");
        for (let s = 0; s <= 14 && alive; s++) { setSecs(s); await wait(330); }
        if (!alive) break;
        setBeat("heard"); await wait(2200); if (!alive) break;
        setBeat("page"); await wait(5600);
      }
    })();
    return () => { alive = false; clearTimeout(timer); };
  }, []);
  return (
    <Phone label="Mindly on a phone: someone talks, then their words become a page titled Busy day with a reminder to call mum">
      <div className="ld-beats" data-beat={beat}>
        <div className="ld-beat talk">{beat !== "page" && <Listening secs={secs} />}</div>
        <div className="ld-beat heard">
          <div className="ld-app ld-entry">
            <p className="ld-date">Today at 9:41</p>
            <p className="ld-heard">{HEARD}</p>
            <p className="ld-busy"><i />Turning your words into a page…</p>
          </div>
        </div>
        <div className="ld-beat page">
          <div className="ld-app ld-entry">
            <p className="ld-date">Today at 9:41</p>
            <p className="ld-title">Busy day</p>
            <p>Today was busy. I finished the slides for Thursday and went to the gym.</p>
            <p>☐ Call my mum</p>
            <div className="ld-remind"><span>You mentioned <b>call my mum</b> for Thu, 9:00. Remind you?</span><span className="ld-yes">Remind me</span></div>
          </div>
        </div>
      </div>
    </Phone>
  );
}

const STEPS = [
  { title: "Talk", body: "Tap the orb and talk the way you talk. Ramble, switch to Pidgin, change your mind halfway." },
  { title: "Page", body: "Mindly writes it up in your words. The ums go, nothing gets added, and plans become a checklist." },
  { title: "Reflect", body: "When you want to go deeper, talk it through with a companion that has read your journal." },
  { title: "Insight", body: "Over the weeks, see how your mood moves and what keeps coming up in your words." },
];

/** The four steps on one phone. It moves on by itself; tapping a step shows it and stops the tour. */
function Steps() {
  const [at, setAt] = useState(0);
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    if (touched || still()) return;
    const t = setInterval(() => setAt((i) => (i + 1) % STEPS.length), 4200);
    return () => clearInterval(t);
  }, [touched]);
  return (
    <section className="ld-steps" aria-labelledby="steps">
      <h2 id="steps" className="ld-h">Four steps. One phone.</h2>
      <div className="ld-steps-body">
        <ol className="ld-step-list">
          {STEPS.map((s, i) => (
            <li key={s.title}>
              <button aria-pressed={i === at} onClick={() => { setAt(i); setTouched(true); }}>
                <span className="ld-n">{i + 1}</span><span className="ld-step-t">{s.title}</span>
                <span className="ld-step-b">{s.body}</span>
              </button>
            </li>
          ))}
        </ol>
        <Phone label={`Mindly on a phone: ${STEPS[at].title}`}>
          <div className="ld-step-screen" key={at}>{[<Listening key="t" secs={42} />, <PageScreen key="p" />, <ReflectScreen key="r" />, <InsightScreen key="i" />][at]}</div>
        </Phone>
      </div>
    </section>
  );
}

function PageScreen() {
  return (
    <div className="ld-app ld-entry">
      <p className="ld-date">Sunday at 10:12</p>
      <p className="ld-title">Sunday reset</p>
      <p>Slept late and it felt earned. Called Tunde and we laughed about the wedding. This week I want to:</p>
      <p>☑ Finish the slides<br />☐ Call Tunde back<br />☐ Book the dentist</p>
    </div>
  );
}

function ReflectScreen() {
  return (
    <div className="ld-app ld-chat">
      <p className="ld-chat-head">About “Busy day”</p>
      <p className="ai"><Mark size={20} /><span>You finished the slides and still made the gym. How are you feeling now the day is winding down?</span></p>
      <p className="me">Tired but proud. The gym helped.</p>
      <p className="ai"><Mark size={20} /><span>That pride sounds earned. What made today feel different from last week?</span></p>
    </div>
  );
}

function InsightScreen() {
  const moods = [3, 4, 2, 3, 4, 5, 4];
  const x = (i: number) => 12 + i * 29, y = (v: number) => 66 - (v - 1) * 14;
  return (
    <div className="ld-app ld-insight">
      <p className="ld-title">Insights</p>
      <p className="ld-small">From your words</p>
      <p>You feel steadier on days you move your body, even busy ones.</p>
      <div className="ld-chips"><span>Work</span><span>Family</span><span>Rest</span></div>
      <p className="ld-small">Mood, last week</p>
      <svg viewBox="0 0 200 76" className="ld-mood">
        <polyline points={moods.map((v, i) => `${x(i)},${y(v)}`).join(" ")} fill="none" stroke="currentColor" strokeOpacity="0.35" strokeWidth="1.5" />
        {moods.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r="5.5" fill={MOODS[v - 1].color} />)}
      </svg>
    </div>
  );
}
