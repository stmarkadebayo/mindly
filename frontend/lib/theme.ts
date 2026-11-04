// Light, dark or follow the device. Applied before first paint by the script in layout.tsx.
export type Theme = "system" | "light" | "dark";
const KEY = "mindly.theme";

export function theme(): Theme {
  try { const t = localStorage.getItem(KEY); return t === "light" || t === "dark" ? t : "system"; } catch { return "system"; }
}

export function setTheme(t: Theme) {
  try { t === "system" ? localStorage.removeItem(KEY) : localStorage.setItem(KEY, t); } catch { /* ignore */ }
  if (t === "system") delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t;
  window.dispatchEvent(new Event("mindly:theme"));
}
