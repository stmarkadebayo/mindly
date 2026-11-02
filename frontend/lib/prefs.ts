// Small per-device preferences. Storage can be unavailable (private windows), so every access is guarded.
const ROOM = "mindly:room";

/** Room mode: for a sermon, lecture or any speaker far from the phone. Turns off the phone's voice "cleanup", which treats distant speech as noise. */
export function roomMode(): boolean {
  try { return localStorage.getItem(ROOM) === "1"; } catch { return false; }
}
export function setRoomMode(on: boolean) {
  try { localStorage.setItem(ROOM, on ? "1" : "0"); } catch { /* ignore */ }
}

const ENGINE = "mindly:engine";

/** Which speech engine to use: Whisper (default) or the alternative one set up on the server, for side-by-side testing. */
export function speechEngine(): "whisper" | "alt" {
  try { return localStorage.getItem(ENGINE) === "alt" ? "alt" : "whisper"; } catch { return "whisper"; }
}
export function setSpeechEngine(e: "whisper" | "alt") {
  try { localStorage.setItem(ENGINE, e); } catch { /* ignore */ }
  window.dispatchEvent(new Event("mindly:engine")); // the header and sidebar each show the toggle; keep them in step
}

const SKIN = "mindly.skin";
export type Skin = "classic" | "paper";

/** The look of the app: Classic, or Paper (a warm, journal-page feel). Applied before first paint by the script in layout.tsx. */
export function skin(): Skin {
  try { return localStorage.getItem(SKIN) === "paper" ? "paper" : "classic"; } catch { return "classic"; }
}
export function setSkin(s: Skin) {
  try { s === "paper" ? localStorage.setItem(SKIN, "paper") : localStorage.removeItem(SKIN); } catch { /* ignore */ }
  if (s === "paper") document.documentElement.dataset.skin = "paper"; else delete document.documentElement.dataset.skin;
}
