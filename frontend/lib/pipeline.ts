// Recording -> transcript -> written text, one segment at a time.
// Every step is saved on the device first, so nothing is lost if the network drops or the tab closes;
// unfinished segments are queued and resumed when the app opens or comes back online.
import { api, ApiError } from "./api";
import * as store from "./store";
import type { Recording } from "./recorder";
import type { Segment } from "./types";

type WriteHook = (entryId: string, text: string, title: string | null) => boolean;

const running = new Set<string>();
let writeHook: WriteHook | null = null; // the open entry page appends text itself, so it never clobbers unsaved typing
let languageHint = "";

export const setWriteHook = (fn: WriteHook | null) => (writeHook = fn);
export const setLanguage = (code: string) => (languageHint = code);

export type EntryEvent = { entryId: string; support?: boolean };
function emit(detail: EntryEvent) {
  window.dispatchEvent(new CustomEvent<EntryEvent>("mindly:entry", { detail }));
}

async function setSegment(entryId: string, segId: string, patch: Partial<Segment>) {
  await store.updateEntry(entryId, (e) => {
    const seg = e.segments.find((s) => s.id === segId);
    if (seg) Object.assign(seg, patch);
  });
  emit({ entryId });
}

export async function addRecording(entryId: string, { blob, ext, seconds }: Recording) {
  const seg: Segment = { id: store.uid(), created: store.now(), seconds, ext, status: "saved", transcript: null, error: null };
  await store.saveAudio(seg.id, entryId, blob);
  await store.updateEntry(entryId, (e) => void e.segments.push(seg));
  emit({ entryId });
  process(entryId, seg.id);
  return seg;
}

export async function process(entryId: string, segId: string) {
  if (running.has(segId)) return;
  running.add(segId);
  try {
    let entry = await store.entry(entryId);
    let seg = entry?.segments.find((s) => s.id === segId);
    if (!entry || !seg || seg.status === "done") return;
    if (!navigator.onLine) return void (await setSegment(entryId, segId, { status: "queued", error: null }));

    if (!seg.transcript) {
      await setSegment(entryId, segId, { status: "transcribing", error: null });
      const form = new FormData();
      const blob = await store.audio(segId);
      if (!blob) throw new ApiError("This recording's audio is missing.");
      form.append("audio", blob, `recording.${seg.ext}`);
      form.append("language", languageHint);
      const heard = await api<{ text: string; language: string; no_speech: boolean }>("/api/transcribe", { method: "POST", form });
      if (heard.no_speech) return void (await setSegment(entryId, segId, { status: "no_speech", error: null }));
      await setSegment(entryId, segId, { transcript: heard.text, language: heard.language });
    }

    await setSegment(entryId, segId, { status: "writing" });
    entry = (await store.entry(entryId))!;
    seg = entry.segments.find((s) => s.id === segId)!;
    const written = await api<{ title: string; body: string; support: boolean }>("/api/write", {
      method: "POST",
      json: { transcript: seg.transcript, prompt: entry.prompt, continuing: Boolean(entry.body.trim()) },
    });
    const title = entry.title ? null : written.title;
    if (!writeHook?.(entryId, written.body, title)) {
      await store.updateEntry(entryId, (e) => {
        e.body = e.body.trim() ? `${e.body.trimEnd()}\n\n${written.body}` : written.body;
        if (title && !e.title) e.title = title;
      });
    }
    await setSegment(entryId, segId, { status: "done", error: null });
    if (written.support) emit({ entryId, support: true });
  } catch (err) {
    const e = err as ApiError;
    if (e.offline) await setSegment(entryId, segId, { status: "queued", error: null });
    else await setSegment(entryId, segId, { status: "failed", error: e.message });
  } finally {
    running.delete(segId);
  }
}

/** Resume anything unfinished: queued, interrupted mid-step, or saved but never sent. */
export async function resumeAll() {
  if (!store.isOpen()) return;
  for (const e of await store.entries()) {
    for (const s of e.segments) {
      if (["saved", "queued", "transcribing", "writing"].includes(s.status)) process(e.id, s.id);
    }
  }
}

if (typeof window !== "undefined") window.addEventListener("online", resumeAll);
