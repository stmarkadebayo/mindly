"use client";
// Reflect: where every conversation with Mindly is kept. Start a new one, or go back into an old one.
import Link from "next/link";
import { useEffect, useState } from "react";
import { Underline } from "./Hand";
import { Icon } from "./Icon";
import { shortDate } from "@/lib/content";
import * as store from "@/lib/store";
import type { Chat, Entry } from "@/lib/types";

export function ReflectHome() {
  const [chats, setChats] = useState<Chat[] | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  useEffect(() => {
    Promise.all([store.chats(), store.entries()]).then(([c, e]) => { setChats(c.filter((x) => x.messages.length)); setEntries(e); });
  }, []);

  const byId = Object.fromEntries(entries.map((e) => [e.id, e]));
  const nameOf = (c: Chat) => c.entryId ? `About “${byId[c.entryId]?.title || "an entry"}”` : (c.messages.find((m) => m.role === "user")?.content ?? "A conversation").slice(0, 60);

  return (
    <main className="screen journal">
      <header className="journal-head">
        <h1 className="large-title"><span className="name">Reflect<span className="underline"><Underline /></span></span></h1>
        <Link className="btn btn-primary reflect-new" href="/talk/?new=1"><Icon name="compose" size={16} />New</Link>
      </header>
      <p className="journal-sub">Talk things through. Every conversation is kept here.</p>

      {chats && chats.length > 0 && (
        <>
          <h2 className="section-label">Your reflections</h2>
          <div className="group">
            {chats.map((c) => (
              <Link key={c.id} className="row" href={c.entryId ? `/talk/?entry=${c.entryId}` : `/talk/?chat=${c.id}`}>
                <span className="grow"><span className="t" style={{ display: "block" }}>{nameOf(c)}</span>
                  <span className="footnote">{shortDate(c.updated)} · {c.messages.length} {c.messages.length === 1 ? "message" : "messages"}</span></span>
                <span className="chev"><Icon name="chev" /></span>
              </Link>
            ))}
          </div>
        </>
      )}
      {chats && chats.length === 0 && <p className="empty-note">Tap New to start your first reflection.</p>}
      <p className="ai-note reflect-foot">Mindly isn&apos;t a therapist. <Link href="/support/">Need support?</Link></p>
    </main>
  );
}
