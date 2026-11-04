"use client";
// The floating bar for the four main places. It shows on the screens you move between, not on ones you work inside.
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

// Drawn by hand to sit with the journal: soft corners, uneven rays, a few loose strokes. `tint` is the part that fills when selected.
const sun = <><path className="tint" d="M12 8.2c2.2-.1 3.9 1.6 3.9 3.8s-1.7 4-3.9 3.9-3.9-1.7-3.9-3.9S9.8 8.3 12 8.2z" />
  <path d="M12 3.2v2.1M12 18.8v2M3.3 12h2.1M18.7 12.1h2M5.9 5.8l1.5 1.4M16.6 16.8l1.5 1.5M5.8 18.1l1.5-1.5M16.7 7.3l1.5-1.4" /></>;
const moon = <><path className="tint" d="M19 14.6A7.4 7.4 0 019.4 5a7.4 7.4 0 109.6 9.6z" /><path d="M17.5 3.6v2.4M16.3 4.8h2.4" /></>;
const journal = <><path className="tint" d="M7 4h10a1.5 1.5 0 011.5 1.5v13A1.5 1.5 0 0117 20H7a1.5 1.5 0 01-1.5-1.5v-13A1.5 1.5 0 017 4z" />
  <path d="M9.6 4v16M12.6 8.6h3.2M12.6 11.8h2.4" /></>;
const reflect = <><path className="tint" d="M5.5 5h13A1.5 1.5 0 0120 6.5v8.3a1.5 1.5 0 01-1.5 1.5h-6.2l-3.8 3v-3H5.5A1.5 1.5 0 014 14.8V6.5A1.5 1.5 0 015.5 5z" />
  <path d="M12 8.1l.9 2 2 .9-2 .9-.9 2-.9-2-2-.9 2-.9z" /></>;
const insights = <><path d="M6.8 15.1l3.4-4.6M12 10.3l2.7 2.3M16.2 12.2l2-4.6" />
  <circle className="tint" cx="6" cy="16" r="1.5" /><circle className="tint" cx="11" cy="9.6" r="1.5" /><circle className="tint" cx="15.5" cy="13.4" r="1.5" /><circle className="tint" cx="19" cy="6.6" r="1.5" /></>;

export const NAV_PATHS = ["/", "/journal/", "/talk/", "/insights/"];

export function NavPill() {
  const path = usePathname() || "/";
  const here = path.endsWith("/") ? path : path + "/";
  const params = useSearchParams();
  const inConversation = !!(params.get("entry") || params.get("chat") || params.get("new"));   // the composer needs the bottom of the screen
  const [night, setNight] = useState(false);
  useEffect(() => { const h = new Date().getHours(); setNight(h >= 19 || h < 5); }, []);
  if (!NAV_PATHS.includes(here) || (here === "/talk/" && inConversation)) return null;
  const items: { href: string; label: string; icon: ReactNode; cls?: string }[] = [
    { href: "/", label: "Today", icon: night ? moon : sun },   // the sun becomes a moon after dark
    { href: "/journal/", label: "Journal", icon: journal, cls: "n-journal" },
    { href: "/talk/", label: "Reflect", icon: reflect },
    { href: "/insights/", label: "Insights", icon: insights },
  ];
  return (
    <nav className="navpill glass chrome" aria-label="Main">
      {items.map((i) => (
        <Link key={i.href} href={i.href} className={i.cls} aria-current={here === i.href ? "page" : undefined}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{i.icon}</svg>
          <span>{i.label}</span>
        </Link>
      ))}
    </nav>
  );
}
