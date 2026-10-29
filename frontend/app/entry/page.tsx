"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { SupportCard, TopBar } from "@/components/Bits";
import { Mark, Ring } from "@/components/Hand";
import { Icon } from "@/components/Icon";
import { BodyEditor, type BodyHandle } from "@/components/BodyEditor";
import { NoteTools } from "@/components/NoteTools";
import { Orb } from "@/components/Orb";
import { useUI } from "@/components/UI";
import { VoiceDock } from "@/components/VoiceDock";
import { dayLabel, MOODS, timeLabel } from "@/lib/content";
import * as pipeline from "@/lib/pipeline";
import type { Recording } from "@/lib/recorder";
import { clock } from "@/lib/recorder";
import * as store from "@/lib/store";
import { imgToken, plain } from "@/lib/text";
import type { Entry, Segment } from "@/lib/types";

export default function EntryPage() {
  return <Suspense><EntryScreen /></Suspense>;
}

function EntryScreen() {
  const id = useSearchParams().get("id") ?? "";
  const router = useRouter();
  const { toast, sheet, confirm } = useUI();

  const [entry, setEntry] = useState<Entry | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const latest = useRef({ title: "", body: "" });
  const dirty = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [saveState, setSaveState] = useState("");
  const [inked, setInked] = useState(0);
  const [support, setSupport] = useState(false);
  const [moodDismissed, setMoodDismissed] = useState(false);
  const [live, setLive] = useState(false);
  const bodyRef = useRef<BodyHandle>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});

  // ---- load ----
  useEffect(() => {
    store.entry(id).then((e) => {
      if (!e) { toast("That entry no longer exists."); router.replace("/"); return; }
      setEntry(e);
      setTitle(e.title);
      setBody(e.body);
      latest.current = { title: e.title, body: e.body };
    });
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Photos live in IndexedDB; show them through temporary object URLs.
  const imageIds = (entry?.images ?? []).map((i) => i.id).join(",");
  useEffect(() => {
    let gone = false;
    const made: string[] = [];
    (async () => {
      const next: Record<string, string> = {};
      for (const im of entry?.images ?? []) {
        const b = await store.image(im.id);
        if (b) { const u = URL.createObjectURL(b); made.push(u); next[im.id] = u; }
      }
      if (!gone) setUrls(next);
    })();
    return () => { gone = true; made.forEach((u) => URL.revokeObjectURL(u)); };
  }, [imageIds]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- autosave ----
  const save = useCallback(async () => {
    clearTimeout(saveTimer.current);
    if (!dirty.current) return;
    dirty.current = false;
    setSaveState("Saving…");
    try {
      const { title: t, body: b } = latest.current;
      const e = await store.updateEntry(id, (x) => { x.title = t.trim(); x.body = b; });
      if (e) setEntry(e);
      setSaveState("Saved");
    } catch {
      dirty.current = true;
      setSaveState("Couldn't save. Retrying…");
      saveTimer.current = setTimeout(save, 2000);
    }
  }, [id]);

  const edit = (patch: Partial<{ title: string; body: string }>) => {
    latest.current = { ...latest.current, ...patch };
    if (patch.title !== undefined) setTitle(patch.title);
    if (patch.body !== undefined) setBody(patch.body);
    dirty.current = true;
    setSaveState("");
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(save, 700);
  };

  // New writing is appended here, not in the store, so it can never overwrite unsaved typing.
  useEffect(() => {
    pipeline.setWriteHook((entryId, text, newTitle) => {
      if (entryId !== id) return false;
      const b = latest.current.body;
      edit({ body: b.trim() ? `${b.trimEnd()}\n\n${text}` : text });
      if (newTitle && !latest.current.title.trim()) edit({ title: newTitle });
      setInked((n) => n + 1);
      save();
      return true;
    });
    const onEntry = (ev: Event) => {
      const d = (ev as CustomEvent<pipeline.EntryEvent>).detail;
      if (d.entryId !== id) return;
      if (d.support) setSupport(true);
      store.entry(id).then((e) => e && setEntry(e));
    };
    window.addEventListener("mindly:entry", onEntry);
    return () => { pipeline.setWriteHook(null); window.removeEventListener("mindly:entry", onEntry); };
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Leaving: flush edits, and drop an entry that never got any content.
  // `alive` guards against React's development double-mount, which runs this cleanup once on arrival.
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      save();
      setTimeout(() => {
        if (!alive.current) store.entry(id).then((x) => { if (x && !x.body.trim() && !x.title && !x.segments.length) store.deleteEntry(id); });
      }, 300);
    };
  }, [id, save]);

  const addImage = async (file: File) => {
    try {
      const small = await shrink(file);
      const imgId = store.uid();
      await store.saveImage(imgId, id, small);
      const e = await store.updateEntry(id, (x) => { x.images = [...(x.images ?? []), { id: imgId, name: file.name }]; });
      if (e) setEntry(e);
      bodyRef.current?.insertImage(imgId);
    } catch { toast("Couldn't add that photo."); }
  };
  const openImage = (imgId: string) => sheet((close) => (
    <>
      {urls[imgId] && /* eslint-disable-next-line @next/next/no-img-element */ <img className="photo-big" src={urls[imgId]} alt="Attached photo" />}
      <button className="btn btn-plain btn-danger btn-block" style={{ marginTop: 8 }} onClick={async () => {
        close();
        await store.deleteImage(imgId);
        edit({ body: latest.current.body.split("\n").filter((l) => l !== imgToken(imgId)).join("\n") });
        const e = await store.updateEntry(id, (x) => { x.images = (x.images ?? []).filter((i) => i.id !== imgId); });
        if (e) setEntry(e);
      }}>Remove photo</button>
    </>
  ));

  if (!entry) return <main className="screen" />;

  const visible = entry.segments.filter((s) => s.status !== "done" && !s.dismissed);
  const hasText = Boolean(plain(body));
  const blank = !hasText && !entry.segments.some((s) => s.status !== "no_speech" && !s.dismissed);
  const showMood = entry.segments.some((s) => s.status === "done") && !entry.mood && !moodDismissed;

  const setMood = async (v: number) => {
    const e = await store.updateEntry(id, (x) => { x.mood = v; });
    if (e) setEntry(e);
  };
  const dismiss = async (segId: string) => {
    const e = await store.updateEntry(id, (x) => { const s = x.segments.find((y) => y.id === segId); if (s) s.dismissed = true; });
    if (e) setEntry(e);
  };
  const onRecording = async (rec: Recording) => { await pipeline.addRecording(id, rec); };
  const openMenu = () => menu(entry, sheet, confirm, setMood, async () => { await store.deleteEntry(id); toast("Entry deleted"); router.replace("/"); });

  return (
    <main className={`screen entry${live ? " live" : ""}`}>
      <div className="recede">
        <TopBar back="/" title={<span className="footnote">{saveState}</span>}
          right={<button className="icon-btn" aria-label="Entry options" onClick={openMenu}><Icon name="more" /></button>} />

        <article className="page">
          <p className="entry-date">{dayLabel(entry.created)} at {timeLabel(entry.created)}{entry.sample && " · Sample entry"}</p>
          {entry.prompt && (
            <p className="entry-prompt">{entry.prompt}
              {!hasText && <button aria-label="Remove prompt" onClick={async () => { const e = await store.updateEntry(id, (x) => { x.prompt = null; }); if (e) setEntry(e); }}><Icon name="close" size={14} /></button>}
            </p>
          )}
          <input className="entry-title" placeholder="Untitled" aria-label="Title" value={title} onChange={(e) => edit({ title: e.target.value })} onBlur={save} />
          <BodyEditor ref={bodyRef} value={body} onChange={(v) => edit({ body: v })} onBlur={save} urls={urls} onOpenImage={openImage}
            className={`entry-body${inked ? (inked % 2 ? " inked" : " inked-again") : ""}`} placeholder={blank ? "Type here, or tap the orb to talk" : "Keep writing…"} />

          {visible.map((s) => <SegmentStatus key={s.id} seg={s} onRetry={() => pipeline.process(id, s.id)} onDismiss={() => dismiss(s.id)} />)}
          {support && <SupportCard />}

          {showMood && (
            <div className="mood-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span className="headline">How are you feeling right now?</span>
                <button className="btn btn-plain" onClick={() => setMoodDismissed(true)}>Skip</button>
              </div>
              <div className="moods">{MOODS.map((m) => (
                <button key={m.v} aria-pressed={false} onClick={() => { setMood(m.v); toast("Mood saved"); }}>
                  <i style={{ background: m.color }} />{m.label}
                </button>))}
              </div>
            </div>
          )}
        </article>
      </div>

      <NoteTools onStyle={(k) => bodyRef.current?.style(k)} onList={(k) => bodyRef.current?.list(k)} onImage={addImage}
        onDivider={() => bodyRef.current?.insertText("— — —\n")}
        onStamp={() => bodyRef.current?.insertText(new Date().toLocaleString([], { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) + " ")} />

      {hasText && (
        <button className="reflect-btn glass chrome" onClick={async () => { await save(); router.push(`/talk/?entry=${id}`); }} aria-label="Reflect on this entry">
          <Mark size={22} />Reflect
        </button>
      )}

      <VoiceDock onRecording={onRecording} onLive={setLive} beforeStart={save} hint={hasText ? "Tap to keep talking" : "Tap to talk"} />
    </main>
  );
}

/** The orb swirls on its own while Mindly is working, so a pause never looks like a failure. */
function Busy({ text }: { text: string }) {
  return <div className="status"><span className="mini"><Orb thinking idle={0.8} /></span><span className="grow">{text}</span></div>;
}

function SegmentStatus({ seg, onRetry, onDismiss }: { seg: Segment; onRetry: () => void; onDismiss: () => void }) {
  if (seg.status === "saved" || seg.status === "transcribing") return <Busy text="Listening back to your recording…" />;
  if (seg.status === "writing") return <Busy text="Turning your words into a page…" />;
  if (seg.status === "queued")
    return <div className="status"><span className="grow">You&apos;re offline. Your recording is saved here and will be written up when you&apos;re back online.</span></div>;
  if (seg.status === "no_speech")
    return <div className="status warn"><span className="grow">No words came through in that recording, so nothing was added. It&apos;s kept under Original recordings.</span><button className="btn btn-plain" onClick={onDismiss}>OK</button></div>;
  return <div className="status warn"><span className="grow">{seg.error || "Something went wrong."} Your recording is safe.</span><button className="btn btn-plain" onClick={onRetry}>Try again</button></div>;
}

type UI = ReturnType<typeof useUI>;

async function menu(entry: Entry, sheet: UI["sheet"], confirm: UI["confirm"], setMood: (v: number) => void, remove: () => void) {
  const recs = await Promise.all(entry.segments.map(async (s) => ({ s, url: URL.createObjectURL((await store.audio(s.id)) ?? new Blob()) })));
  sheet((close) => <EntryMenu entry={entry} recs={recs} setMood={setMood} onDelete={async () => {
    close();
    if (await confirm({ title: "Delete this entry?", body: "Its text, recordings and reflection will be removed from this device. This can't be undone.", action: "Delete entry" })) remove();
  }} />, () => recs.forEach((r) => URL.revokeObjectURL(r.url)));
}

function EntryMenu({ entry, recs, setMood, onDelete }: {
  entry: Entry; recs: { s: Segment; url: string }[]; setMood: (v: number) => void; onDelete: () => void;
}) {
  const [mood, setLocal] = useState(entry.mood);
  return (
    <>
      <h2>This entry</h2>
      <p className="section-label" style={{ marginLeft: 0 }}>Mood</p>
      <div className="moods">{MOODS.map((m) => (
        <button key={m.v} aria-pressed={mood === m.v} onClick={() => { setLocal(m.v); setMood(m.v); }}>
          {mood === m.v && <Ring />}<i style={{ background: m.color }} />{m.label}
        </button>))}
      </div>
      <p className="section-label" style={{ marginLeft: 0 }}>Original recordings</p>
      <div className="group">
        {recs.length ? recs.map(({ s, url }, i) => (
          <div key={s.id} className="rec">
            <div className="footnote">Recording {i + 1}, {clock(s.seconds || 0)} long, at {timeLabel(s.created)}</div>
            <audio controls preload="none" src={url} />
            <div className="transcript">{s.transcript ?? <i>{s.status === "no_speech" ? "No words detected." : "No transcript yet."}</i>}</div>
          </div>
        )) : <p className="subhead">This entry has no recordings.</p>}
      </div>
      <p className="footnote">Transcripts are machine-made and may contain mistakes. The page is the version you control.</p>
      <button className="btn btn-plain btn-danger btn-block" style={{ marginTop: 8 }} onClick={onDelete}>Delete entry</button>
    </>
  );
}

/** Photos are shrunk before saving so a journal full of them stays small on the device. */
async function shrink(file: File, max = 1600): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * k);
  c.height = Math.round(bmp.height * k);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close();
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("encode"))), "image/jpeg", 0.85));
}
