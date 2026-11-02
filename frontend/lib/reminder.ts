// The daily reminder: a web-push subscription plus the time of day the person picked.
import { api } from "./api";

const KEY = "mindly:reminder";
export const savedTime = (): string => { try { return localStorage.getItem(KEY) ?? ""; } catch { return ""; } };
const remember = (t: string) => { try { t ? localStorage.setItem(KEY, t) : localStorage.removeItem(KEY); } catch { /* ignore */ } };

const keyBytes = (b64: string) => Uint8Array.from(atob(b64.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

/** Ask permission, subscribe this device, and tell the server the local time to nudge. Throws a message fit to show. */
export async function enableReminder(publicKey: string, time: string) {
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window))
    throw new Error("This browser can't receive reminders. On iPhone, add Mindly to your Home Screen first.");
  if ((await Notification.requestPermission()) !== "granted") throw new Error("Notifications are blocked for Mindly. Allow them in your browser settings.");
  const reg = await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) }));
  const [h, m] = time.split(":").map(Number);
  await api("/api/reminder", { method: "PUT", json: { subscription: sub.toJSON(), minutes: h * 60 + m, tz_offset: -new Date().getTimezoneOffset() } });
  remember(time);
}

export async function disableReminder() {
  await api("/api/reminder", { method: "DELETE" }).catch(() => {});
  try { await (await (await navigator.serviceWorker.ready).pushManager.getSubscription())?.unsubscribe(); } catch { /* ignore */ }
  remember("");
}
