"use client";
// The top bar. On a phone it is the top of Today: the logo opens your menu, the name sits in the middle, and your streak (or level)
// is on the right. On a desktop it runs across the whole window: the logo folds the sidebar away, and your menu lives at the bottom of it.
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Mark } from "./Hand";
import { LevelBody, useProgress } from "./Level";
import { useSession } from "./Session";
import { setTheme, theme, type Theme } from "@/lib/theme";

/** Close a popover on an outside press or Escape. `keep` marks the button that opened it, so pressing it again toggles. */
function useDismiss(open: boolean, close: () => void, keep: string) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node) && !(e.target as HTMLElement).closest(keep)) close(); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", away); document.removeEventListener("keydown", esc); };
  }, [open, close, keep]);
  return box;
}

export function AppHeader({ className, onToggleSidebar }: { className: string; onToggleSidebar?: () => void }) {
  const { me } = useSession();
  const p = useProgress();
  const [menu, setMenu] = useState(false);
  const [level, setLevel] = useState(false);
  const levelBox = useDismiss(level, () => setLevel(false), ".streak-pill");
  if (!me) return null;
  return (
    <header className={className}>
      <div className="menu-wrap">
        {onToggleSidebar
          ? <button className="logo-btn" aria-label="Show or hide the sidebar" onClick={onToggleSidebar}><Mark size={30} /></button>
          : <>
              <button className="logo-btn" aria-label="Menu" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu((o) => !o)}><Mark size={30} /></button>
              {menu && <ProfileMenu onClose={() => setMenu(false)} keep=".logo-btn" />}
            </>}
      </div>
      <span className="wordmark">mindly</span>
      <div className="head-right">
        {p && (
          <>
            <button className={`streak-pill${p.streak ? "" : " quiet"}`} aria-expanded={level} aria-label={p.streak ? `${p.streak}-day streak, ${p.name}` : `Level: ${p.name}`}
              onClick={() => setLevel((o) => !o)}>
              {p.streak > 0 ? <><span aria-hidden="true">🔥</span>{p.streak}</> : p.name}
            </button>
            {level && <div ref={levelBox} className="level-pop glass" role="dialog" aria-label="Your journal level"><LevelBody p={p} /></div>}
          </>
        )}
      </div>
    </header>
  );
}

/** Your name and level at the bottom of the sidebar; it opens the same menu upwards. */
export function ProfileCard() {
  const { me } = useSession();
  const p = useProgress();
  const [open, setOpen] = useState(false);
  if (!me) return null;
  return (
    <div className="side-foot">
      {open && <ProfileMenu onClose={() => setOpen(false)} keep=".profile-card" up />}
      <button className="profile-card" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="avatar" aria-hidden="true">{(me.name || me.email)[0].toUpperCase()}</span>
        <span className="pm-text"><b>{me.name || "You"}</b>{p && <small className="pm-level">{p.name}</small>}</span>
      </button>
    </div>
  );
}

function ProfileMenu({ onClose, keep, up = false }: { onClose: () => void; keep: string; up?: boolean }) {
  const { me, signOut } = useSession();
  const p = useProgress();
  const box = useDismiss(true, onClose, keep);
  const [t, setT] = useState<Theme>("system");
  useEffect(() => { setT(theme()); }, []);
  if (!me) return null;
  return (
    <div ref={box} className={`profile-menu glass${up ? " up" : ""}`} role="menu">
      <div className="pm-who">
        <span className="avatar" aria-hidden="true">{(me.name || me.email)[0].toUpperCase()}</span>
        <span className="pm-text"><b>{me.name || "You"}</b><small>{me.email}</small>{p && <small className="pm-level">{p.name}</small>}</span>
      </div>
      <div className="pm-row"><span>Theme</span>
        <div className="segmented">{(["system", "light", "dark"] as Theme[]).map((x) => (
          <button key={x} aria-pressed={t === x} onClick={() => { setT(x); setTheme(x); }}>{x[0].toUpperCase() + x.slice(1)}</button>))}</div>
      </div>
      <Link className="pm-item" href="/settings/" role="menuitem" onClick={onClose}>Settings</Link>
      <button className="pm-item" role="menuitem" onClick={() => { onClose(); signOut(); }}>Sign out</button>
    </div>
  );
}
