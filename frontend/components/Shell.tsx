"use client";
// On a wide screen the signed-in screens share a journal sidebar, and the screen itself opens in the pane beside it.
// On a phone or tablet the sidebar is hidden and the wrappers disappear (display: contents), so nothing changes.
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type ReactNode } from "react";
import { EntryList, matches } from "./EntryList";
import { Mark } from "./Hand";
import { Icon } from "./Icon";
import { useSession } from "./Session";
import * as store from "@/lib/store";
import { plain } from "@/lib/text";
import type { Entry } from "@/lib/types";

const APP = ["/", "/entry/", "/talk/", "/insights/", "/settings/"];
const norm = (p: string) => (p.endsWith("/") ? p : p + "/");

export function Shell({ children }: { children: ReactNode }) {
  const { me } = useSession();
  const path = norm(usePathname() || "/");
  if (!me || !me.profile.onboarded || !APP.includes(path)) return <>{children}</>;
  return (
    <div className="shell">
      <Suspense fallback={<aside className="sidebar" />}><Sidebar /></Suspense>
      <div className="pane" data-pane>
        <div className="pane-scroll">{children}</div>
      </div>
    </div>
  );
}

function Sidebar() {
  const { me } = useSession();
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
      <div className="side-head">
        <Link href="/" aria-label="Mindly home"><Mark size={28} /></Link>
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <Link className="icon-btn" href="/insights/" aria-label="Insights"><Icon name="chart" /></Link>
          <Link className="avatar" href="/settings/" aria-label="Settings">{(me!.name || me!.email)[0].toUpperCase()}</Link>
        </div>
      </div>
      <Link className="btn btn-tinted side-new" href="/">New entry</Link>
      {real.length > 0 && (
        <div className="search"><Icon name="search" /><input className="input" type="search" placeholder="Search your journal" aria-label="Search your journal" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      )}
      {real.length === 0 && <p className="empty-note">Your entries will gather here.</p>}
      {real.length > 0 && shown.length === 0 && <p className="empty-note">Nothing matches &ldquo;{q}&rdquo;.</p>}
      <EntryList entries={shown} activeId={active} />
    </aside>
  );
}
