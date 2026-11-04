import { beforeEach, describe, expect, it } from "vitest";
import * as store from "@/lib/store";
import { entryOn, freshJournal } from "./helpers";

beforeEach(freshJournal);

describe("entries list", () => {
  it("is sorted newest first", async () => {
    await store.putEntries([entryOn("2026-01-01"), entryOn("2026-03-01"), entryOn("2026-02-01")]);
    expect((await store.entries()).map((e) => e.created.slice(0, 7))).toEqual(["2026-03", "2026-02", "2026-01"]);
  });

  it("is read once and shared until something is written", async () => {
    await store.newEntry();
    const [a, b] = await Promise.all([store.entries(), store.entries()]);
    expect(a).toBe(b);
    expect(await store.entries()).toBe(a);
  });

  it("shows every kind of write straight away", async () => {
    const e = await store.newEntry();
    expect(await store.entries()).toHaveLength(1);

    await store.updateEntry(e.id, (x) => { x.body = "changed"; });
    expect((await store.entries())[0].body).toBe("changed");

    await store.putEntries([entryOn("2026-01-01")]);
    expect(await store.entries()).toHaveLength(2);

    await store.deleteEntry(e.id);
    expect((await store.entries()).map((x) => x.id)).not.toContain(e.id);
  });

  it("starts empty again for another account", async () => {
    await store.newEntry();
    await freshJournal();
    expect(await store.entries()).toEqual([]);
  });

  it("rejects, rather than throws, when no journal is open", async () => {
    store.close();
    await expect(store.entries()).rejects.toThrow();
  });
});

describe("updateEntry", () => {
  it("never loses one of two overlapping changes", async () => {
    const e = await store.newEntry();
    await Promise.all([
      store.updateEntry(e.id, (x) => { x.title = "title"; }),
      store.updateEntry(e.id, (x) => { x.mood = 4; }),
    ]);
    const after = await store.entry(e.id);
    expect(after?.title).toBe("title");
    expect(after?.mood).toBe(4);
  });

  it("returns null for an entry that doesn't exist", async () => {
    expect(await store.updateEntry("missing", () => {})).toBeNull();
  });
});

describe("deleteEntry", () => {
  it("removes the entry with its recordings, photos and conversation", async () => {
    const e = await store.newEntry();
    await store.saveAudio("a1", e.id, new Blob(["x"]));
    await store.saveImage("i1", e.id, new Blob(["y"]));
    await store.saveChat({ id: "c1", entryId: e.id, created: store.now(), updated: store.now(), messages: [] });
    await store.deleteEntry(e.id);
    expect(await store.entry(e.id)).toBeUndefined();
    expect(await store.audio("a1")).toBeNull();
    expect(await store.image("i1")).toBeNull();
    expect(await store.chats()).toEqual([]);
  });
});

describe("importAll", () => {
  it("adds new entries, keeps the newer copy of shared ones, and deletes nothing", async () => {
    const mine = entryOn("2026-01-01", "mine, edited later", { updated: "2026-05-01T00:00:00.000Z" });
    const onlyHere = entryOn("2026-01-02", "only on this device");
    await store.putEntries([mine, onlyHere]);
    const older = { ...mine, body: "older copy", updated: "2026-02-01T00:00:00.000Z" };
    const added = entryOn("2026-01-03", "from the other device");
    const n = await store.importAll({ app: "Mindly", entries: [older, added], chats: [], recordings: [], images: [] });
    expect(n).toBe(1);
    const all = await store.entries();
    expect(all).toHaveLength(3);
    expect(all.find((e) => e.id === mine.id)?.body).toBe("mine, edited later");
  });

  it("refuses something that isn't a Mindly export", async () => {
    await expect(store.importAll({ hello: 1 })).rejects.toThrow("Mindly export");
  });
});
