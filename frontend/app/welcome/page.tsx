"use client";
import Link from "next/link";
import { Mark, Sparkles } from "@/components/Hand";
import { Icon, type IconName } from "@/components/Icon";
import { Orb } from "@/components/Orb";

const REPO = "https://github.com/stmarkadebayo/mindly";

const STEPS: { icon: IconName; title: string; body: string }[] = [
  { icon: "mic", title: "Speak", body: "Tap the orb and say what's on your mind, in English, Pidgin, Yoruba or Hausa. Switch languages mid-sentence if that's how you talk." },
  { icon: "spark", title: "Get your page", body: "An open AI model turns your ramble into a clear, written page in your own words. Your voice, your facts, nothing added." },
  { icon: "heart", title: "Reflect", body: "Chat with a companion that has read your journal, notice how your mood moves, and come back to what mattered." },
];

const PRIVACY: { icon: IconName; title: string; body: string }[] = [
  { icon: "device", title: "Your journal stays on your device", body: "Entries, recordings and conversations live in your browser's private storage, not on a server." },
  { icon: "mic", title: "Heard, written, forgotten", body: "Audio and text reach the server only long enough to be transcribed and written. Nothing is kept or used to train a model." },
  { icon: "lock", title: "Yours alone", body: "Add a PIN lock, export everything, or wipe it all with one tap." },
];

export default function Welcome() {
  return (
    <main className="welcome">
      <header className="brand-row">
        <div className="brand"><Mark size={26} />Mindly</div>
        <nav className="land-nav" aria-label="Main">
          <a href={REPO} target="_blank" rel="noopener noreferrer">GitHub</a>
          <Link href="/auth/?mode=signin">Sign in</Link>
          <Link className="btn btn-primary" href="/auth/?mode=signup">Get started</Link>
        </nav>
      </header>

      <section className="hero">
        <div className="stage">
          <div className="orb"><Orb idle={1.7} /></div>
          <Sparkles className="sparkles" />
        </div>
        <div className="copy">
          <p className="eyebrow">A voice-first journal</p>
          <h1 className="large-title">Talk it out.<br />Mindly keeps the page.</h1>
          <p className="subhead lead" style={{ margin: 0 }}>
            A private journal you speak to. Say what&apos;s on your mind and get back a clear page in your own words.
          </p>
          <div className="actions">
            <Link className="btn btn-primary btn-block" href="/auth/?mode=signup">Get started</Link>
            <Link className="btn btn-plain btn-block" href="/auth/?mode=signin">I already have an account</Link>
          </div>
        </div>
      </section>

      <div className="landing">
        <section aria-labelledby="how">
          <h2 id="how" className="land-h">How it works</h2>
          <div className="cards three">
            {STEPS.map((s, i) => (
              <article key={s.title} className="card">
                <span className="card-ic"><Icon name={s.icon} /></span>
                <p className="card-n">0{i + 1}</p>
                <h3>{s.title}</h3>
                <p>{s.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section aria-labelledby="private">
          <h2 id="private" className="land-h">Private by design</h2>
          <div className="cards three">
            {PRIVACY.map((s) => (
              <article key={s.title} className="card">
                <span className="card-ic"><Icon name={s.icon} /></span>
                <h3>{s.title}</h3>
                <p>{s.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="open" aria-labelledby="open">
          <div>
            <h2 id="open" className="land-h left">Built on open models</h2>
            <p className="lead-2">Mindly runs on open-weight models, so anyone can inspect, swap and run them.</p>
            <ul className="models">
              <li><b>Whisper large-v3-turbo</b> hears you and turns speech into text.</li>
              <li><b>Gemma</b> writes your page and powers the reflective chat.</li>
            </ul>
            <p className="footnote">Open weights come with licences. Mindly credits and follows them, and works with any OpenAI-compatible endpoint.</p>
          </div>
          <div className="open-card">
            <p className="hand">Open source, built for OPEN//BUILD 2026</p>
            <p className="subhead">Read the code, run it yourself, or help improve it.</p>
            <a className="btn btn-tinted" href={REPO} target="_blank" rel="noopener noreferrer">View on GitHub</a>
          </div>
        </section>

        <section className="cta" aria-label="Get started">
          <h2 className="large-title">Start your first page.</h2>
          <p className="subhead">It takes under a minute. No card, no clutter.</p>
          <Link className="btn btn-primary" href="/auth/?mode=signup">Get started</Link>
          <p className="footnote care">Mindly is a journal with a thoughtful companion, not therapy or a crisis service. If you&apos;re in danger, call 112.</p>
        </section>

        <footer className="land-foot">
          <span>© 2026 Mindly</span>
          <Link href="/privacy/">Privacy</Link>
          <Link href="/terms/">Terms</Link>
          <Link href="/support/">Need support?</Link>
          <a href={REPO} target="_blank" rel="noopener noreferrer">GitHub</a>
        </footer>
      </div>
    </main>
  );
}
