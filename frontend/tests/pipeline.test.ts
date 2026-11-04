// Recording -> transcript -> page: the core of the product, run against a real (in-memory) journal and a fake server.
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as pipeline from "@/lib/pipeline";
import * as store from "@/lib/store";
import type { Segment } from "@/lib/types";
import { entryOn, freshJournal, serve } from "./helpers";

const rec = { blob: new Blob(["audio"], { type: "audio/webm" }), ext: "webm", seconds: 5 };
const heard = { text: "I went for a run and felt great", language: "en", no_speech: false };
const page = { title: "A good run", body: "I went for a run and felt great.", support: false, actions: [], done: [] };

const segOf = async (entryId: string): Promise<Segment> => (await store.entry(entryId))!.segments[0];
const settle = (entryId: string, status: Segment["status"]) => vi.waitFor(async () => expect((await segOf(entryId)).status).toBe(status));

beforeEach(async () => { await freshJournal(); pipeline.setWriteHook(null); });

describe("a recording becomes a page", () => {
  it("transcribes, writes, titles the entry and finishes", async () => {
    const calls = serve({ "/api/transcribe": () => heard, "/api/write": () => page, "/api/metric": () => ({}) });
    const e = await store.newEntry();
    await pipeline.addRecording(e.id, rec);
    await settle(e.id, "done");
    const after = (await store.entry(e.id))!;
    expect(after.body).toBe(page.body);
    expect(after.title).toBe("A good run");
    expect(after.segments[0].transcript).toBe(heard.text);
    expect(calls.map((c) => c.path)).toEqual(["/api/transcribe", "/api/write", "/api/metric"]);
  });

  it("has the words on the device while the page is still being written", async () => {
    let release!: () => void;
    const held = new Promise<void>((r) => (release = r));
    serve({ "/api/transcribe": () => heard, "/api/write": () => held.then(() => new Response(JSON.stringify(page))), "/api/metric": () => ({}) });
    const e = await store.newEntry();
    await pipeline.addRecording(e.id, rec);
    await settle(e.id, "writing");
    expect((await segOf(e.id)).transcript).toBe(heard.text);
    release();
    await settle(e.id, "done");
  });

  it("adds to what is already there instead of replacing it, and keeps the title", async () => {
    serve({ "/api/transcribe": () => heard, "/api/write": () => page, "/api/metric": () => ({}) });
    const e = await store.newEntry();
    await store.updateEntry(e.id, (x) => { x.title = "Mine"; x.body = "Earlier words."; });
    await pipeline.addRecording(e.id, rec);
    await settle(e.id, "done");
    const after = (await store.entry(e.id))!;
    expect(after.body).toBe(`Earlier words.\n\n${page.body}`);
    expect(after.title).toBe("Mine");
  });

  it("lets the open entry page take the text, so unsaved typing is never overwritten", async () => {
    serve({ "/api/transcribe": () => heard, "/api/write": () => page, "/api/metric": () => ({}) });
    const e = await store.newEntry();
    const taken: string[] = [];
    pipeline.setWriteHook((id, text) => { if (id !== e.id) return false; taken.push(text); return true; });
    await pipeline.addRecording(e.id, rec);
    await settle(e.id, "done");
    expect(taken).toEqual([page.body]);
    expect((await store.entry(e.id))!.body).toBe("");
  });
});

describe("when things go wrong, the recording is never lost", () => {
  it("silence is marked as no speech and nothing is written", async () => {
    const calls = serve({ "/api/transcribe": () => ({ ...heard, text: "", no_speech: true }) });
    const e = await store.newEntry();
    await pipeline.addRecording(e.id, rec);
    await settle(e.id, "no_speech");
    expect(calls.map((c) => c.path)).toEqual(["/api/transcribe"]);
    expect(await store.audio((await segOf(e.id)).id)).not.toBeNull();
  });

  it("offline, it waits in the queue and finishes once back online", async () => {
    (navigator as { onLine: boolean }).onLine = false;
    serve({ "/api/transcribe": () => heard, "/api/write": () => page, "/api/metric": () => ({}) });
    const e = await store.newEntry();
    await pipeline.addRecording(e.id, rec);
    await settle(e.id, "queued");
    (navigator as { onLine: boolean }).onLine = true;
    await pipeline.resumeAll();
    await settle(e.id, "done");
  });

  it("a dropped connection mid-way is queued, not failed", async () => {
    globalThis.fetch = (() => Promise.reject(new TypeError("network"))) as typeof fetch;
    const e = await store.newEntry();
    await pipeline.addRecording(e.id, rec);
    await settle(e.id, "queued");
  });

  it("the free daily limit fails the step and tells the app to offer Pro", async () => {
    serve({ "/api/transcribe": () => new Response(JSON.stringify({ detail: "You've used today's 10 free minutes" }), { status: 402 }) });
    const offered = vi.fn();
    window.addEventListener("mindly:limit", offered);
    const e = await store.newEntry();
    await pipeline.addRecording(e.id, rec);
    await settle(e.id, "failed");
    expect((await segOf(e.id)).error).toContain("free minutes");
    expect(offered).toHaveBeenCalledOnce();
    window.removeEventListener("mindly:limit", offered);
  });

  it("a retry after a failed write reuses the transcript instead of transcribing again", async () => {
    let writes = 0;
    const calls = serve({
      "/api/transcribe": () => heard,
      "/api/write": () => (++writes === 1 ? new Response("{}", { status: 502 }) : page),
      "/api/metric": () => ({}),
    });
    const e = await store.newEntry();
    await pipeline.addRecording(e.id, rec);
    await settle(e.id, "failed");
    await pipeline.process(e.id, (await segOf(e.id)).id);
    await settle(e.id, "done");
    expect(calls.filter((c) => c.path === "/api/transcribe")).toHaveLength(1);
  });
});

describe("saying a task is done ticks it off", () => {
  it("ticks the line in the other entry and records it so it can be undone", async () => {
    const todo = entryOn("2026-01-01", "☐ call mum\n☐ buy milk");
    await store.putEntries([todo]);
    serve({ "/api/transcribe": () => heard, "/api/write": (b) => {
      const task = (b as { open_tasks: { id: string; text: string }[] }).open_tasks.find((t) => t.text === "call mum")!;
      return { ...page, done: [task.id] };
    }, "/api/metric": () => ({}) });
    const e = await store.newEntry();
    await pipeline.addRecording(e.id, rec);
    await settle(e.id, "done");
    expect((await store.entry(todo.id))!.body).toBe("☑ call mum\n☐ buy milk");
    expect((await store.entry(e.id))!.completions?.map((c) => c.text)).toEqual(["call mum"]);
  });
});
