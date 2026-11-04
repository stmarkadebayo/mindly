"use client";
// On a wide screen the signed-in screens share a journal sidebar, and the screen itself opens in the pane beside it.
// On a phone or tablet the sidebar is hidden and the wrappers disappear (display: contents), so nothing changes.
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { EntryList, matches } from "./EntryList";
import { AppHeader, ProfileCard } from "./AppHeader";
import { NavPill } from "./NavPill";
import { Icon } from "./Icon";
import { useGoPro } from "./GoPro";
import { useSession } from "./Session";
import { useUI } from "./UI";
import { refresh } from "@/lib/insights";
import { progress } from "@/lib/level";
import * as store from "@/lib/store";
import { plain } from "@/lib/text";
import type { Entry } from "@/lib/types";

const APP = ["/", "/entry/", "/talk/", "/insights/", "/settings/", "/journal/"];
const norm = (p: string) => (p.endsWith("/") ? p : p + "/");

// The sidebar only shows on wide screens, so on a phone it isn't built at all (it would hold the whole journal, unseen).
const WIDE = "(min-width: 1100px)";
const onWideChange = (fn: () => void) => { const m = matchMedia(WIDE); m.addEventListener("change", fn); return () => m.removeEventListener("change", fn); };
const useWide = () => useSyncExternalStore(onWideChange, () => matchMedia(WIDE).matches, () => false);

/** Prepares things in the background so screens open already filled: today, the Insights reading, a little after the entries change. */
function Background({ userId }: { userId: string }) {
  const { toast } = useUI();
  // A small celebration when you reach a new journal level. The first look only records where you are.
  useEffect(() => {
    const key = `mindly.level.${userId}`;
    const check = () => store.entries().then((all) => {
      const now = progress(all);
      let seen: number | null = null;
      try { const v = localStorage.getItem(key); seen = v === null ? null : Number(v); localStorage.setItem(key, String(now.level)); } catch { return; }
      if (seen !== null && now.level > seen) toast(`New level: ${now.name}`);
    }).catch(() => {});
    check();
    window.addEventListener("mindly:entry", check);
    return () => window.removeEventListener("mindly:entry", check);
  }, [userId, toast]);
  // Pro is raised only at moments that make sense: the free speech limit, and once after a few pages while on the trial.
  const goPro = useGoPro();
  const { me } = useSession();
  useEffect(() => {
    const onLimit = () => toast("You've used today's free speech. Your pages stay yours.", { label: "See Pro", run: goPro });
    const onEntry = () => {
      if (!me || me.paid || !me.on_trial) return;
      const key = `mindly.nudge.pages.${userId}`;
      try { if (localStorage.getItem(key)) return; } catch { return; }
      store.entries().then((all) => {
        if (all.filter((e) => !e.sample && e.body.trim()).length < 5) return;
        try { localStorage.setItem(key, "1"); } catch { /* shown again next time */ }
        toast(`Five pages in. Pro keeps speech unlimited after your trial.`, { label: "See Pro", run: goPro });
      }).catch(() => {});
    };
    window.addEventListener("mindly:limit", onLimit);
    window.addEventListener("mindly:entry", onEntry);
    return () => { window.removeEventListener("mindly:limit", onLimit); window.removeEventListener("mindly:entry", onEntry); };
  }, [userId, toast, goPro, me]);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const soon = () => {
      clearTimeout(timer);
      timer = setTimeout(() => { if (navigator.onLine) store.entries().then((all) => refresh(userId, all)).catch(() => {}); }, 20_000);
    };
    soon();
    window.addEventListener("mindly:entry", soon);
    return () => { clearTimeout(timer); window.removeEventListener("mindly:entry", soon); };
  }, [userId]);
  return null;
}

export function Shell({ children }: { children: ReactNode }) {
  const { me } = useSession();
  const path = norm(usePathname() || "/");
  const wide = useWide();
  const [folded, setFolded] = useState(false);   // desktop only: the logo folds the sidebar away
  useEffect(() => { try { setFolded(localStorage.getItem("mindly.sidebar") === "folded"); } catch { /* open */ } }, []);
  const toggle = () => setFolded((f) => { try { localStorage.setItem("mindly.sidebar", f ? "open" : "folded"); } catch { /* not saved */ } return !f; });
  if (!me || !me.profile.onboarded || !APP.includes(path)) return <>{children}</>;
  return (
    <div className={`shell${folded ? " folded" : ""}`}>
      <Background userId={me.id} />
      <AppHeader className="desk-head" onToggleSidebar={toggle} />
      {wide && <Suspense fallback={<aside className="sidebar" />}><Sidebar /></Suspense>}
      <div className="pane" data-pane>
        <div className="pane-scroll">{children}</div>
        <Suspense fallback={null}><NavPill /></Suspense>
      </div>
    </div>
  );
}

function Sidebar() {
  const active = useSearchParams().get("id");
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    const load = () => store.entries().then(setEntries);
    load();
    window.addEventListener("mindly:entry", load);
    return () => window.removeEventListener("mindly:entry", load);
  }, []);

  const real = (entries ?? []).filter((e) => e.body.trim() || e.title || e.segments.length);
  const shown = real.filter((e) => matches(e, q, plain));

  return (
    <aside className="sidebar" aria-label="Your journal">
      <div className="side-scroll">
        <Link className="btn btn-tinted side-new" href="/">New entry</Link>
        {real.length > 0 && (
          <div className="search"><Icon name="search" /><input className="input" type="search" placeholder="Search your journal" aria-label="Search your journal" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        )}
        {real.length === 0 && <><p className="empty-note">Your entries will gather here.</p></>}
        {real.length > 0 && shown.length === 0 && <p className="empty-note">Nothing matches &ldquo;{q}&rdquo;.</p>}
        <EntryList entries={shown} activeId={active} />
      </div>
      <ProfileCard />
    </aside>
  );
}
