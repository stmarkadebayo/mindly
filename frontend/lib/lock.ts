// App lock: a 4-digit PIN. It's a privacy screen for shared phones, not encryption.
// The PIN is stored only as a salted PBKDF2 hash, per account, in this browser.

const key = (userId: string) => `mindly.pin.${userId}`;
export const LOCK_AFTER_MS = 2 * 60 * 1000;

function read(userId: string): { salt: string; hash: string } | null {
  try {
    return JSON.parse(localStorage.getItem(key(userId)) || "null");
  } catch {
    return null;
  }
}

export const hasPin = (userId: string) => Boolean(read(userId));
export function clearPin(userId: string) {
  try {
    localStorage.removeItem(key(userId));
  } catch {}
}

const hex = (bytes: Uint8Array) => [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");

async function hash(pin: string, saltHex: string) {
  const salt = Uint8Array.from(saltHex.match(/../g)!.map((h) => parseInt(h, 16)));
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 150000, hash: "SHA-256" }, base, 256);
  return hex(new Uint8Array(bits));
}

export async function setPin(userId: string, pin: string) {
  const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
  localStorage.setItem(key(userId), JSON.stringify({ salt, hash: await hash(pin, salt) }));
}

export async function checkPin(userId: string, pin: string) {
  const saved = read(userId);
  return Boolean(saved && (await hash(pin, saved.salt)) === saved.hash);
}
