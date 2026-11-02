// On-device journal storage (IndexedDB). One database per account, so people sharing a device stay separate.
import type { Chat, Entry } from "./types";

let db: IDBDatabase | null = null;

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

export async function open(userId: string) {
  db?.close();
  const r = indexedDB.open(`mindly-${userId}`, 2);
  r.onupgradeneeded = () => {
    const d = r.result;
    if (!d.objectStoreNames.contains("entries")) d.createObjectStore("entries", { keyPath: "id" });
    if (!d.objectStoreNames.contains("audio")) d.createObjectStore("audio", { keyPath: "id" }).createIndex("entryId", "entryId");
    if (!d.objectStoreNames.contains("chats")) d.createObjectStore("chats", { keyPath: "id" }).createIndex("entryId", "entryId");
    if (!d.objectStoreNames.contains("images")) d.createObjectStore("images", { keyPath: "id" }).createIndex("entryId", "entryId");
  };
  db = await req(r);
  // Ask the browser not to evict the journal under storage pressure.
  navigator.storage?.persist?.().catch(() => {});
}

export function close() {
  db?.close();
  db = null;
}

export const isOpen = () => db !== null;

function need(): IDBDatabase {
  if (!db) throw new Error("Journal is not open.");
  return db;
}
const tx = (store: string, mode: IDBTransactionMode = "readonly") => need().transaction(store, mode).objectStore(store);

export const uid = () => crypto.randomUUID();
export const now = () => new Date().toISOString();

// --- entries ---------------------------------------------------------------
export async function entries(): Promise<Entry[]> {
  const all = await req<Entry[]>(tx("entries").getAll());
  return all.sort((a, b) => b.created.localeCompare(a.created));
}
/** Write several entries in one transaction (used for the example journal). */
export function putEntries(list: Entry[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = need().transaction("entries", "readwrite");
    const s = t.objectStore("entries");
    list.forEach((e) => s.put(e));
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}
export const entry = (id: string) => req<Entry | undefined>(tx("entries").get(id));

export async function newEntry(prompt: string | null = null): Promise<Entry> {
  const e: Entry = { id: uid(), created: now(), updated: now(), title: "", body: "", prompt, mood: null, segments: [] };
  await req(tx("entries", "readwrite").put(e));
  return e;
}

/**
 * Read, change and write an entry inside one transaction. IndexedDB runs overlapping readwrite
 * transactions one at a time, so concurrent updates (autosave, recordings finishing) can't overwrite
 * each other. `change` must be synchronous.
 */
export function updateEntry(id: string, change: (e: Entry) => void): Promise<Entry | null> {
  return new Promise((resolve, reject) => {
    const t = need().transaction("entries", "readwrite");
    const s = t.objectStore("entries");
    let result: Entry | null = null;
    const r = s.get(id);
    r.onsuccess = () => {
      if (!r.result) return;
      result = r.result as Entry;
      change(result);
      result.updated = now();
      s.put(result);
    };
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error);
  });
}

export async function deleteEntry(id: string) {
  const t = need().transaction(["entries", "audio", "chats", "images"], "readwrite");
  t.objectStore("entries").delete(id);
  for (const name of ["audio", "chats", "images"]) {
    const store = t.objectStore(name);
    const keys = await req(store.index("entryId").getAllKeys(id));
    keys.forEach((k) => store.delete(k));
  }
  await new Promise<void>((resolve, reject) => {
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

// --- audio -----------------------------------------------------------------
export const saveAudio = (id: string, entryId: string, blob: Blob) => req(tx("audio", "readwrite").put({ id, entryId, blob }));
export async function audio(id: string): Promise<Blob | null> {
  const row = await req<{ blob: Blob } | undefined>(tx("audio").get(id));
  return row?.blob ?? null;
}

// --- images ----------------------------------------------------------------
export const saveImage = (id: string, entryId: string, blob: Blob) => req(tx("images", "readwrite").put({ id, entryId, blob }));
export const deleteImage = (id: string) => req(tx("images", "readwrite").delete(id));
export async function image(id: string): Promise<Blob | null> {
  const row = await req<{ blob: Blob } | undefined>(tx("images").get(id));
  return row?.blob ?? null;
}

// --- chats -----------------------------------------------------------------
export async function chats(): Promise<Chat[]> {
  const all = await req<Chat[]>(tx("chats").getAll());
  return all.sort((a, b) => b.updated.localeCompare(a.updated));
}
export const saveChat = (c: Chat) => req(tx("chats", "readwrite").put({ ...c, updated: now() }));
export async function chatForEntry(entryId: string): Promise<Chat | null> {
  const found = await req<Chat[]>(tx("chats").index("entryId").getAll(entryId));
  return found[0] ?? null;
}

// --- export / wipe ------------------------------------------------------------
const toDataUrl = (blob: Blob) =>
  new Promise<string>((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.readAsDataURL(blob);
  });

export async function exportAll() {
  const rows = await req<{ id: string; entryId: string; blob: Blob }[]>(tx("audio").getAll());
  const recordings = await Promise.all(rows.map(async (a) => ({ id: a.id, entryId: a.entryId, dataUrl: await toDataUrl(a.blob) })));
  const imgRows = await req<{ id: string; entryId: string; blob: Blob }[]>(tx("images").getAll());
  const images = await Promise.all(imgRows.map(async (a) => ({ id: a.id, entryId: a.entryId, dataUrl: await toDataUrl(a.blob) })));
  return { app: "Mindly", exported: now(), entries: await entries(), chats: await chats(), recordings, images };
}

const toBlob = async (dataUrl: string) => (await fetch(dataUrl)).blob();

/**
 * Merge an exported journal into this one (the way to bring two devices in line without any server).
 * Entries and chats are matched by id and the most recently edited copy wins; recordings and photos
 * are added when missing. Nothing is deleted. Returns how many entries were added or updated.
 */
export async function importAll(data: any): Promise<number> {
  if (data?.app !== "Mindly" || !Array.isArray(data.entries)) throw new Error("That doesn't look like a Mindly export.");
  const mine = new Map((await entries()).map((e) => [e.id, e]));
  const take = (data.entries as Entry[]).filter((e) => e?.id && typeof e.created === "string" && (!mine.has(e.id) || (e.updated ?? "") > mine.get(e.id)!.updated));
  await putEntries(take);
  const have = async (name: string) => new Set(await req<IDBValidKey[]>(tx(name).getAllKeys()));
  for (const [name, rows] of [["audio", data.recordings], ["images", data.images]] as const) {
    const present = await have(name);
    for (const r of Array.isArray(rows) ? rows : []) {
      if (r?.id && r.dataUrl && !present.has(r.id)) await req(tx(name, "readwrite").put({ id: r.id, entryId: r.entryId, blob: await toBlob(r.dataUrl) }));
    }
  }
  const myChats = new Map((await chats()).map((c) => [c.id, c]));
  for (const c of Array.isArray(data.chats) ? (data.chats as Chat[]) : []) {
    if (c?.id && (!myChats.has(c.id) || c.updated > myChats.get(c.id)!.updated)) await req(tx("chats", "readwrite").put(c));
  }
  return take.length;
}

export async function wipe(userId: string) {
  close();
  await req(indexedDB.deleteDatabase(`mindly-${userId}`));
}
