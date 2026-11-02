"use client";
// The floating bar for the four main places. It shows on the screens you move between, not on ones you work inside.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "./Icon";

const ITEMS: { href: string; label: string; icon: IconName; cls?: string }[] = [
  { href: "/", label: "Today", icon: "sun" },
  { href: "/journal/", label: "Journal", icon: "book", cls: "n-journal" },
  { href: "/talk/", label: "Reflect", icon: "chat" },
  { href: "/insights/", label: "Insights", icon: "chart" },
];
export const NAV_PATHS = ["/", "/journal/", "/insights/"];

export function NavPill() {
  const path = usePathname() || "/";
  const here = path.endsWith("/") ? path : path + "/";
  if (!NAV_PATHS.includes(here)) return null;
  return (
    <nav className="navpill glass chrome" aria-label="Main">
      {ITEMS.map((i) => (
        <Link key={i.href} href={i.href} className={i.cls} aria-current={here === i.href ? "page" : undefined}>
          <Icon name={i.icon} /><span>{i.label}</span>
        </Link>
      ))}
    </nav>
  );
}
