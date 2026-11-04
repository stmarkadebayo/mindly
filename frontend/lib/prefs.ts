// Small per-device preferences. Storage can be unavailable (private windows), so every access is guarded.
const ROOM = "mindly:room";

/** Room mode: for a sermon, lecture or any speaker far from the phone. Turns off the phone's voice "cleanup", which treats distant speech as noise. */
export function roomMode(): boolean {
  try { return localStorage.getItem(ROOM) === "1"; } catch { return false; }
}
export function setRoomMode(on: boolean) {
  try { localStorage.setItem(ROOM, on ? "1" : "0"); } catch { /* ignore */ }
}
