"use client";
import { plain } from "@/lib/text";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Fragment, Suspense, useEffect, useRef, useState } from "react";
import { MicDenied, SupportCard, TopBar } from "@/components/Bits";
import { Mark } from "@/components/Hand";
import { Icon } from "@/components/Icon";
import { Orb } from "@/components/Orb";
import { useMe } from "@/components/Session";
import { useUI } from "@/components/UI";
import { api, ApiError } from "@/lib/api";
import { shortDate } from "@/lib/content";
import { pickContext } from "@/lib/context";
import { streamCompanion } from "@/lib/stream";
import { MicDeniedError, Recorder } from "@/lib/recorder";
import * as store from "@/lib/store";
import type { Chat, ChatMessage, Entry } from "@/lib/types";

export default function TalkPage() {
  return <Suspense><Talk /></Suspense>;
}

function Talk() {
  const params = useSearchParams();
  const anchorId = params.get("entry");
  const fresh = params.get("new") === "1";
  const me = useMe();
  const router = useRouter();
  const { toast, sheet } = useUI();
  const [chat, setChat] = useState<Chat | null>(null);
  const [byId, setById] = useState<Record<string, Entry>>({});
  const [anchor, setAnchor] = useState<Entry | null>(null);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState("");
  const [support, setSupport] = useState(false);
  const [text, setText] = useState("");
  const [micLive, setMicLive] = useState(false);
  const [micStream, setMicStream] = useState<MediaStream | null>(null);
  const mic = useRef<Recorder | null>(null);
  const first = me.name?.split(" ")[0];

  useEffect(() => {
    (async () => {
      const all = await store.entries();
      setById(Object.fromEntries(all.map((e) => [e.id, e])));
      const a = anchorId ? all.find((e) => e.id === anchorId) ?? null : null;
      if (anchorId && !a) return router.replace("/");
      setAnchor(a);
      let c = anchorId ? await store.chatForEntry(anchorId) : fresh ? null : (await store.chats()).find((x) => !x.entryId) ?? null;
      c ??= { id: store.uid(), entryId: anchorId, created: store.now(), updated: store.now(), messages: [] };
      setChat(c);
      if (a && !c.messages.length) ask(c); // the first tap on Reflect is enough to get an insight
    })();
    return () => { mic.current?.stop(false); };
  }, [anchorId, fresh]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { window.scrollTo({ top: document.body.scrollHeight, behavior: draft ? "auto" : "smooth" }); }, [chat, busy, support, draft]);

  async function ask(c: Chat) {
    setBusy(true);
    setDraft("");
    try {
      const all = await store.entries();
      const reading = all.find((x) => x.id === c.entryId);
      const query = [plain(reading?.body ?? ""), ...c.messages.filter((m) => m.role === "user").slice(-3).map((m) => m.content)].join(" ");
      const res = await streamCompanion({
        entries: pickContext(all, query, c.entryId), anchor_id: c.entryId,
        messages: c.messages.map(({ role, content }) => ({ role, content })),
      }, setDraft);
      const next = { ...c, messages: [...c.messages, { role: "assistant" as const, content: res.reply, sources: res.sources }] };
      setChat(next);
      setDraft("");
      if (res.support) setSupport(true);
      await store.saveChat(next);
    } catch (e) {
      const err = e as ApiError;
      toast(err.offline ? "You're offline. Your message is saved; send again when you're connected." : err.message);
    } finally { setBusy(false); setDraft(""); }
  }

  const send = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const content = text.trim();
    if (!content || busy || !chat) return;
    setText("");
    const next = { ...chat, messages: [...chat.messages, { role: "user" as const, content }] };
    setChat(next);
    await store.saveChat(next);
    ask(next);
  };

  // Voice input: record, transcribe, and drop the words into the box to review before sending.
  const toggleMic = async () => {
    if (mic.current) {
      const r = await mic.current.stop(true);
      mic.current = null;
      setMicLive(false);
      setMicStream(null);
      if (!r) return;
      try {
        const form = new FormData();
        form.append("audio", r.blob, `message.${r.ext}`);
        form.append("language", me.profile.speechLanguage || "");
        const heard = await api<{ text: string; no_speech: boolean }>("/api/transcribe", { method: "POST", form });
        if (heard.no_speech) toast("No words came through. Try again?");
        else setText((t) => (t ? t + " " : "") + heard.text);
      } catch (err) { toast((err as Error).message); }
      return;
    }
    const rec = new Recorder({ onAutoStop: () => toggleMic() });
    try { const s = await rec.start(); mic.current = rec; setMicStream(s); setMicLive(true); }
    catch (err) { err instanceof MicDeniedError ? sheet((close) => <MicDenied close={close} />, undefined, "alert") : toast((err as Error).message); }
  };

  const greeting: ChatMessage | null = anchorId ? null : {
    role: "assistant", content: `Hi${first ? ` ${first}` : ""}. What's on your mind? Say as much or as little as you like. You can type, or tap the orb to talk.`,
  };

  return (
    <main className="screen">
      <TopBar back={anchorId ? `/entry/?id=${anchorId}` : "/"} title={anchor ? `Reflecting on “${anchor.title || "this entry"}”` : "Talk it through"}
        right={anchorId ? undefined : <Link className="icon-btn" href="/talk/?new=1" aria-label="New conversation"><Icon name="compose" /></Link>} />
      <p className="footnote" style={{ textAlign: "center", margin: "0 0 8px" }}>
        Mindly listens and reflects using your journal. It isn&apos;t a therapist. <Link href="/support/">Need support?</Link>
      </p>
      <div className="thread">
        {greeting && <Message m={greeting} byId={byId} anchorId={anchorId} />}
        {chat?.messages.map((m, i) => <Message key={i} m={m} byId={byId} anchorId={anchorId} />)}
        {support && <SupportCard />}
        {draft && <div className="msg ai"><Mark size={26} /><div className="bubble">{draft}</div></div>}
        {busy && !draft && <div className="msg ai"><Mark size={26} /><div className="bubble"><span className="typing"><i /><i /><i /></span></div></div>}
      </div>
      <div className="composer">
        <form className="glass" onSubmit={send}>
          <textarea rows={1} value={text} maxLength={2000} placeholder={micLive ? "Listening… tap the orb when you're done" : anchorId ? "Say more…" : "What's on your mind?"} aria-label="Message"
            onChange={(e) => { setText(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(140, e.target.scrollHeight) + "px"; }}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} />
          {text.trim()
            ? <button className="icon-btn send" aria-label="Send" disabled={busy}><Icon name="send" /></button>
            : <button type="button" className={`orb-mic${micLive ? " live" : ""}`} aria-label={micLive ? "Stop and transcribe" : "Speak your message"} onClick={toggleMic}>
                <Orb stream={micStream} idle={0.8} />
              </button>}
        </form>
      </div>
    </main>
  );
}

/** Renders a reply, turning [#entry-id] citations into dated links and listing the entries it drew on. */
function Message({ m, byId, anchorId }: { m: ChatMessage; byId: Record<string, Entry>; anchorId: string | null }) {
  if (m.role === "user") return <div className="msg me"><div className="bubble">{m.content}</div></div>;
  const parts = m.content.split(/(\[#[\w-]+\])/g);
  const others = (m.sources ?? []).filter((id) => id !== anchorId && byId[id]);
  return (
    <div className="msg ai">
      <Mark size={26} />
      <div>
        <div className="bubble">
          {parts.map((p, i) => {
            const cite = p.match(/^\[#([\w-]+)\]$/);
            if (!cite) return <Fragment key={i}>{p}</Fragment>;
            const src = byId[cite[1]];
            return src ? <Link key={i} className="cite" href={`/entry/?id=${src.id}`} title={src.title}>{shortDate(src.created)}</Link> : null;
          })}
        </div>
        {m.sources && (others.length > 0 || anchorId) && (
          <div className="based">
            {others.length
              ? <>Drawn from {anchorId ? "this entry and " : ""}{others.map((id, i) => <Fragment key={id}>{i ? ", " : ""}<Link href={`/entry/?id=${id}`}>{byId[id].title || "Untitled"}</Link></Fragment>)}</>
              : "Drawn from this entry"}
          </div>
        )}
      </div>
    </div>
  );
}
