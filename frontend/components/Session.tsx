"use client";
// Who is signed in, where they're allowed to be, and the app lock.
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import * as store from "@/lib/store";
import * as pipeline from "@/lib/pipeline";
import { addSample, DEMO_EMAIL } from "@/lib/sample";
import { checkPin, clearPin, hasPin, LOCK_AFTER_MS } from "@/lib/lock";
import type { User } from "@/lib/types";
import { Orb } from "./Orb";
import { Keypad } from "./Keypad";

interface SessionContext {
  me: User | null;
  config: { google_client_id?: string | null };
  setMe: (u: User) => void;
  signedIn: (u: User) => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<SessionContext | null>(null);
export const useSession = () => useContext(Ctx)!;
/** For screens that only render when signed in. */
export const useMe = () => useSession().me!;

const PUBLIC = ["/welcome/", "/auth/", "/privacy/", "/terms/", "/support/"];
const norm = (p: string) => (p.endsWith("/") ? p : p + "/");

export function SessionProvider({ children }: { children: ReactNode }) {
  const [me, setMeState] = useState<User | null>(null);
  const [config, setConfig] = useState({});
  const [ready, setReady] = useState(false);
  const [locked, setLocked] = useState(false);
  const hiddenAt = useRef<number | null>(null);
  const router = useRouter();
  const path = norm(usePathname() || "/");

  const signedIn = useCallback(async (u: User) => {
    await store.open(u.id);
    if (u.email.toLowerCase() === DEMO_EMAIL) await addSample().catch(() => {}); // judges land on a journal that is already full
    pipeline.setLanguage(u.profile.speechLanguage || "");
    setMeState(u);
    setLocked(hasPin(u.id));
    pipeline.resumeAll();
  }, []);

  const signedOut = useCallback(() => {
    store.close();
    setMeState(null);
    router.replace("/welcome/");
  }, [router]);

  const signOut = useCallback(async () => {
    await api("/api/auth/logout", { method: "POST" }).catch(() => {});
    signedOut();
  }, [signedOut]);

  useEffect(() => {
    (async () => {
      setConfig(await api("/api/config").catch(() => ({})));
      try { await signedIn(await api<User>("/api/me", { quiet: true })); } catch { /* signed out */ }
      setReady(true);
    })();
    const onSignedOut = () => signedOut();
    window.addEventListener("mindly:signed-out", onSignedOut);
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") navigator.serviceWorker.register("/sw.js").catch(() => {});
    return () => window.removeEventListener("mindly:signed-out", onSignedOut);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-lock after the app has been in the background for a while.
  useEffect(() => {
    const onVis = () => {
      if (document.hidden) hiddenAt.current = Date.now();
      else if (me && hasPin(me.id) && hiddenAt.current && Date.now() - hiddenAt.current > LOCK_AFTER_MS) setLocked(true);
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [me]);

  // Route guard.
  const isPublic = PUBLIC.includes(path);
  let redirect: string | null = null;
  if (ready) {
    if (!me && !isPublic) redirect = "/welcome/";
    else if (me && (path === "/welcome/" || path === "/auth/")) redirect = "/";
    else if (me && !me.profile.onboarded && path !== "/onboarding/" && !isPublic) redirect = "/onboarding/";
  }
  useEffect(() => { if (redirect) router.replace(redirect); }, [redirect, router]);

  if (!ready || redirect) {
    return <div className="boot"><Orb idle={1.4} style={{ width: 96, height: 96 }} /></div>;
  }

  return (
    <Ctx.Provider value={{ me, config, setMe: setMeState, signedIn, signOut }}>
      {children}
      {locked && me && (
        <LockScreen
          onPin={(pin) => checkPin(me.id, pin).then((ok) => { if (ok) setLocked(false); return ok; })}
          onForgot={() => { clearPin(me.id); setLocked(false); signOut(); }}
        />
      )}
    </Ctx.Provider>
  );
}

function LockScreen({ onPin, onForgot }: { onPin: (pin: string) => Promise<boolean>; onForgot: () => void }) {
  return (
    <div className="lock">
      <div style={{ width: 72, height: 72 }}><Orb idle={1.2} /></div>
      <p className="headline" style={{ margin: 0 }}>Enter your PIN</p>
      <Keypad onComplete={onPin} />
      <button className="btn btn-plain" onClick={onForgot}>Forgot PIN? Sign out</button>
    </div>
  );
}
