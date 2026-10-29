"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { TopBar } from "@/components/Bits";
import { Underline } from "@/components/Hand";
import { useSession } from "@/components/Session";
import { api, ApiError } from "@/lib/api";
import type { User } from "@/lib/types";

declare global {
  interface Window { google?: any; __mindlyGsi?: boolean } // eslint-disable-line @typescript-eslint/no-explicit-any
}

export default function AuthPage() {
  return <Suspense><Auth /></Suspense>;
}

function Auth() {
  const signup = useSearchParams().get("mode") !== "signin";
  const { config, signedIn } = useSession();
  const router = useRouter();
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const googleSlot = useRef<HTMLDivElement>(null);
  const onCredential = useRef<(credential: string) => void>(() => {});
  onCredential.current = async (credential) => {
    try { await finish(await api<User>("/api/auth/google", { method: "POST", json: { credential } })); }
    catch (error) { setErr((error as Error).message); }
  };

  const finish = async (user: User) => {
    await signedIn(user);
    router.replace(user.profile.onboarded ? "/" : "/onboarding/");
  };

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setErr("");
    try {
      const body: Record<string, string> = { email: String(f.get("email")), password: String(f.get("password")) };
      if (signup) body.name = String(f.get("name") || "");
      await finish(await api<User>(signup ? "/api/auth/signup" : "/api/auth/login", { method: "POST", json: body }));
    } catch (error) {
      const ex = error as ApiError;
      setErr(ex.offline ? "You're offline. Connect to the internet to sign in." : ex.message);
      setBusy(false);
    }
  };

  // Google Identity Services renders its own button when a client ID is configured.
  useEffect(() => {
    const clientId = config.google_client_id;
    if (!clientId || !googleSlot.current) return;
    const render = () => {
      if (!window.__mindlyGsi) { // Google asks to be initialised once; the ref keeps the callback current
        window.google.accounts.id.initialize({ client_id: clientId, callback: ({ credential }: { credential: string }) => onCredential.current(credential) });
        window.__mindlyGsi = true;
      }
      window.google.accounts.id.renderButton(googleSlot.current, {
        theme: "outline", size: "large", shape: "pill", width: Math.min(380, window.innerWidth - 40), text: signup ? "signup_with" : "signin_with",
      });
    };
    if (window.google?.accounts) return render();
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.onload = render;
    document.head.append(s);
  }, [config.google_client_id, signup]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <main className="screen">
      <TopBar back="/welcome/" />
      <section className="auth">
        <h1 className="large-title">{signup ? "Make it yours" : "Welcome back"}</h1>
        <Underline width={signup ? 190 : 210} />
        <p className="subhead" style={{ marginTop: 12 }}>
          {signup ? "Your account keeps you signed in. Your journal itself stays on this device." : "Sign in to open your journal on this device."}
        </p>
        {config.google_client_id && <>
          <div ref={googleSlot} style={{ minHeight: 44, display: "flex", justifyContent: "center", marginTop: 24 }} />
          <div className="or">or use email</div>
        </>}
        <form onSubmit={submit} noValidate style={{ marginTop: config.google_client_id ? 0 : 24 }}>
          {signup && <div className="field"><label htmlFor="name">First name</label><input className="input" id="name" name="name" autoComplete="given-name" /></div>}
          <div className="field"><label htmlFor="email">Email</label><input className="input" id="email" name="email" type="email" autoComplete="email" required /></div>
          <div className="field"><label htmlFor="password">Password</label>
            <input className="input" id="password" name="password" type="password" required minLength={8}
              autoComplete={signup ? "new-password" : "current-password"} placeholder={signup ? "At least 8 characters" : ""} /></div>
          <p className="error" role="alert">{err}</p>
          <button className="btn btn-primary btn-block" disabled={busy}>{signup ? "Create account" : "Sign in"}</button>
        </form>
        <p className="footnote" style={{ textAlign: "center", marginTop: 20 }}>
          {signup ? <>Already have an account? <Link href="/auth/?mode=signin">Sign in</Link></> : <>New here? <Link href="/auth/?mode=signup">Create an account</Link></>}
        </p>
        <p className="footnote" style={{ textAlign: "center" }}>
          By continuing you agree to the <Link href="/terms/">terms</Link> and <Link href="/privacy/">privacy notice</Link>.
        </p>
      </section>
    </main>
  );
}
