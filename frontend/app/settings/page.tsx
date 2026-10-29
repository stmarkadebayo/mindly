"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { TopBar } from "@/components/Bits";
import { Icon } from "@/components/Icon";
import { Keypad } from "@/components/Keypad";
import { useMe, useSession } from "@/components/Session";
import { useUI } from "@/components/UI";
import { api } from "@/lib/api";
import { clearPin, hasPin, setPin } from "@/lib/lock";
import * as pipeline from "@/lib/pipeline";
import * as sample from "@/lib/sample";
import * as store from "@/lib/store";
import type { User } from "@/lib/types";

type Theme = "system" | "light" | "dark";

export default function Settings() {
  const me = useMe();
  const { setMe, signOut } = useSession();
  const { toast, sheet, confirm } = useUI();
  const router = useRouter();
  const [name, setName] = useState(me.name);
  const [theme, setTheme] = useState<Theme>("system");
  const [locked, setLocked] = useState(false);
  const [samples, setSamples] = useState(0);

  useEffect(() => {
    try { setTheme((localStorage.getItem("mindly.theme") as Theme) || "system"); } catch {}
    setLocked(hasPin(me.id));
    sample.sampleCount().then(setSamples).catch(() => {});
  }, [me.id]);

  const update = async (patch: { name?: string; profile?: User["profile"] }, message: string) => {
    try { setMe(await api<User>("/api/me", { method: "PUT", json: patch })); toast(message); }
    catch (e) { toast((e as Error).message); }
  };

  const chooseTheme = (t: Theme) => {
    setTheme(t);
    try { t === "system" ? localStorage.removeItem("mindly.theme") : localStorage.setItem("mindly.theme", t); } catch {}
    if (t === "system") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = t;
  };

  const lockSheet = async () => {
    if (locked) {
      if (await confirm({ title: "Turn off app lock?", body: "Mindly will open without asking for your PIN.", action: "Turn off", cancel: "Keep it on" })) {
        clearPin(me.id); setLocked(false); toast("App lock turned off");
      }
      return;
    }
    let first: string | null = null;
    sheet((close) => <PinSetup onDone={async (pin) => { await setPin(me.id, pin); setLocked(true); close(); toast("App lock is on"); }} firstRef={{ get: () => first, set: (v) => (first = v) }} />);
  };

  const exportJournal = async () => {
    toast("Preparing your export…");
    const data = await store.exportAll();
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    Object.assign(document.createElement("a"), { href: url, download: `mindly-journal-${new Date().toISOString().slice(0, 10)}.json` }).click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  const removeSamples = async () => {
    if (!(await confirm({ title: "Remove the sample entries?", body: "The example entries are deleted, including any changes you made to them. Your own entries stay.", action: "Remove", cancel: "Keep them" }))) return;
    const n = await sample.removeSample();
    setSamples(0);
    window.dispatchEvent(new Event("mindly:entry"));
    toast(n ? "Sample entries removed" : "No sample entries to remove");
  };

  const wipe = async () => {
    if (!(await confirm({ title: "Delete your journal from this device?", body: "Every entry, recording and conversation here will be permanently removed. Export first if you want a copy.", action: "Delete everything" }))) return;
    await store.wipe(me.id);
    await store.open(me.id);
    toast("Your journal was deleted from this device.");
    router.push("/");
  };

  const deleteAccount = async () => {
    if (!(await confirm({ title: "Delete your account?", body: "Your account and everything Mindly stores on this device will be permanently deleted. This can't be undone.", action: "Delete account" }))) return;
    try {
      await api("/api/me", { method: "DELETE" });
      await store.wipe(me.id);
      clearPin(me.id);
      toast("Your account was deleted.");
      signOut();
    } catch (e) { toast((e as Error).message); }
  };

  return (
    <main className="screen">
      <TopBar back="/" title="Settings" />

      <h2 className="section-label">Profile</h2>
      <div className="group">
        <label className="row"><span className="grow">Name</span>
          <input className="input" style={{ maxWidth: 200, minHeight: 36, textAlign: "right", background: "none", padding: 0 }}
            value={name} onChange={(e) => setName(e.target.value)} onBlur={() => name !== me.name && update({ name }, "Name saved")} /></label>
        <div className="row"><span className="grow">Account</span><span className="detail">{me.email}{me.google ? " (Google)" : ""}</span></div>
      </div>

      <h2 className="section-label">Recording</h2>
      <div className="group">
        <label className="row"><span className="grow">Speech language</span>
          <select className="detail" style={{ border: 0, background: "none" }} value={me.profile.speechLanguage || ""}
            onChange={(e) => { pipeline.setLanguage(e.target.value); update({ profile: { ...me.profile, speechLanguage: e.target.value } }, "Speech language saved"); }}>
            <option value="">Auto (English, Pidgin, Yoruba)</option><option value="yo">Yoruba only</option>
          </select></label>
      </div>
      <p className="footnote" style={{ margin: "6px 0 0" }}>Mindly hears English, Nigerian Pidgin and Yoruba. Pidgin and Yoruba can need a quick edit afterwards.</p>

      <h2 className="section-label">Appearance</h2>
      <div className="group">
        <div className="row"><span className="grow">Theme</span>
          <div className="segmented">{(["system", "light", "dark"] as Theme[]).map((t) => (
            <button key={t} aria-pressed={theme === t} onClick={() => chooseTheme(t)}>{t[0].toUpperCase() + t.slice(1)}</button>))}</div></div>
      </div>

      <h2 className="section-label">Privacy</h2>
      <div className="group">
        <button className="row" onClick={lockSheet}><span className="grow">App lock</span><span className="detail">{locked ? "On" : "Off"}</span><span className="chev"><Icon name="chev" /></span></button>
        <Link className="row" href="/privacy/"><span className="grow">How your data is handled</span><span className="chev"><Icon name="chev" /></span></Link>
        <button className="row" onClick={exportJournal}><span className="grow">Export journal</span><span className="chev"><Icon name="chev" /></span></button>
        {samples > 0 && <button className="row" onClick={removeSamples}><span className="grow">Remove sample entries</span><span className="detail">{samples}</span></button>}
        <button className="row btn-danger" onClick={wipe}><span className="grow">Delete journal from this device</span></button>
      </div>

      <h2 className="section-label">Help</h2>
      <div className="group">
        <Link className="row" href="/support/"><span className="grow">Get support</span><span className="chev"><Icon name="chev" /></span></Link>
        <Link className="row" href="/terms/"><span className="grow">Terms and disclaimer</span><span className="chev"><Icon name="chev" /></span></Link>
      </div>

      <h2 className="section-label">Account</h2>
      <div className="group">
        <button className="row" onClick={signOut}><span className="grow">Sign out</span></button>
        <button className="row btn-danger" onClick={deleteAccount}><span className="grow">Delete account</span></button>
      </div>

      <p className="footnote" style={{ textAlign: "center", marginTop: 28 }}>Speech by Whisper. Writing and reflection by Gemma 4, an open-weight model.</p>
    </main>
  );
}

function PinSetup({ onDone, firstRef }: { onDone: (pin: string) => void; firstRef: { get: () => string | null; set: (v: string | null) => void } }) {
  const [label, setLabel] = useState("Choose a 4-digit PIN");
  return (
    <>
      <h2>{label}</h2>
      <p className="subhead">This locks Mindly on this device. If you forget it, sign out and sign back in.</p>
      <div style={{ display: "grid", justifyItems: "center", margin: "16px 0" }}>
        <Keypad onComplete={(pin) => {
          const first = firstRef.get();
          if (!first) { firstRef.set(pin); setLabel("Enter it again"); return true; }
          if (pin !== first) { firstRef.set(null); setLabel("Those didn't match. Choose a PIN"); return false; }
          onDone(pin);
          return true;
        }} />
      </div>
    </>
  );
}
