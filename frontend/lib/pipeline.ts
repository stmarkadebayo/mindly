// Recording -> transcript -> written text, one segment at a time.
// Every step is saved on the device first, so nothing is lost if the network drops or the tab closes;
// unfinished segments are queued and resumed when the app opens or comes back online.
import { api, ApiError } from "./api";
import * as store from "./store";
import type { Recording } from "./recorder";
import { roomMode } from "./prefs";
import type { Segment, Suggestion } from "./types";

type WriteHook = (entryId: string, text: string, title: string | null) => boolean;

const running = new Set<string>();
let writeHook: WriteHook | null = null; // the open entry page appends text itself, so it never clobbers unsaved typing

export const setWriteHook = (fn: WriteHook | null) => (writeHook = fn);

export type EntryEvent = { entryId: string; support?: boolean; uncertain?: boolean };
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
  const seg: Segment = { id: store.uid(), created: store.now(), seconds, ext, status: "saved", transcript: null, error: null, room: roomMode() };
  await store.saveAudio(seg.id, entryId, blob);
  await store.updateEntry(entryId, (e) => void e.segments.push(seg));
  emit({ entryId });
  process(entryId, seg.id);
  return seg;
}

const TASK = /^☐ (.+)$/;

/** Unticked checklist lines across the journal (newest entries first), so a recording that says "I did it" can tick them. */
async function openTasks(): Promise<{ id: string; text: string }[]> {
  const out: { id: string; text: string }[] = [];
  for (const e of await store.entries()) {
    e.body.split("\n").forEach((line, i) => { const m = TASK.exec(line); if (m && out.length < 20) out.push({ id: `${e.id}#${i}`, text: m[1].slice(0, 200) }); });
  }
  return out;
}

/** Tick the finished tasks and note it on the entry that said so, where the person can undo it. Returns how many were ticked. */
async function completeTasks(sourceId: string, tasks: { id: string; text: string }[], ids: string[]) {
  for (const id of ids) {
    const [targetId, line] = [id.slice(0, id.lastIndexOf("#")), Number(id.slice(id.lastIndexOf("#") + 1))];
    const task = tasks.find((t) => t.id === id);
    if (!task || targetId === sourceId) continue; // an entry being written is owned by its page; leave it to the person
    let ticked = false;
    await store.updateEntry(targetId, (e) => {
      const lines = e.body.split("\n");
      if (lines[line] === `☐ ${task.text}`) { lines[line] = `☑ ${task.text}`; e.body = lines.join("\n"); ticked = true; }
    });
    if (ticked) await store.updateEntry(sourceId, (e) => { e.completions = [...(e.completions ?? []), { id: store.uid(), entryId: targetId, text: task.text, at: store.now() }]; });
  }
}

/** The device's local date and time as "YYYY-MM-DDTHH:MM, Weekday", so "Friday at 5" can be resolved. */
function localNow() {
  const d = new Date(), p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}, ${d.toLocaleDateString("en", { weekday: "long" })}`;
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
      if (seg.room) form.append("room", "1");
      const heard = await api<{ text: string; language: string; no_speech: boolean; uncertain?: boolean; marked?: string }>("/api/transcribe", { method: "POST", form });
      if (heard.no_speech) return void (await setSegment(entryId, segId, { status: "no_speech", error: null }));
      // The words are on the page (faded) from here, while the writing step tidies them.
      await setSegment(entryId, segId, { status: "writing", transcript: heard.text, marked: heard.marked, language: heard.language, uncertain: heard.uncertain });
    } else {
      await setSegment(entryId, segId, { status: "writing" });
    }
    entry = (await store.entry(entryId))!;
    seg = entry.segments.find((s) => s.id === segId)!;
    const tasks = await openTasks();
    const written = await api<{ title: string; body: string; support: boolean; empty?: boolean; actions?: Omit<Suggestion, "id" | "status">[]; done?: string[] }>("/api/write", {
      method: "POST",
      json: { transcript: seg.marked ?? seg.transcript, prompt: entry.prompt, continuing: Boolean(entry.body.trim()), now: localNow(), open_tasks: tasks },
    });
    if (written.empty) return void (await setSegment(entryId, segId, { status: "no_speech", error: null }));
    const title = entry.title ? null : written.title;
    if (!writeHook?.(entryId, written.body, title)) {
      await store.updateEntry(entryId, (e) => {
        e.body = e.body.trim() ? `${e.body.trimEnd()}\n\n${written.body}` : written.body;
        if (title && !e.title) e.title = title;
      });
    }
    if (written.actions?.length) {
      await store.updateEntry(entryId, (e) => {
        e.suggestions = [...(e.suggestions ?? []), ...written.actions!.map((a) => ({ ...a, id: store.uid(), status: "pending" as const }))];
      });
    }
    if (written.done?.length) await completeTasks(entryId, tasks, written.done);
    await setSegment(entryId, segId, { status: "done", error: null });
    api("/api/metric", { method: "POST", json: { kind: "entry" }, quiet: true }).catch(() => {});
    if (written.support || seg.uncertain) emit({ entryId, support: written.support || undefined, uncertain: seg.uncertain });
  } catch (err) {
    const e = err as ApiError;
    if (e.offline) return void (await setSegment(entryId, segId, { status: "queued", error: null }));
    if (e.status === 402) window.dispatchEvent(new Event("mindly:limit"));
    await setSegment(entryId, segId, { status: "failed", error: e.message });
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
