"use client";
import type { ReactNode } from "react";
import { TopBar } from "./Bits";
import { useSession } from "./Session";

/** A plain reading page that returns to Settings when signed in, or Welcome when not. */
export function Prose({ title, children }: { title: string; children: ReactNode }) {
  const { me } = useSession();
  return (
    <main className="screen">
      <TopBar back={me ? "/settings/" : "/welcome/"} title={title} />
      <article className="prose">{children}</article>
    </main>
  );
}
