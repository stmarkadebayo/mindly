// Copy and small formatting helpers shared across screens.
import type { Profile } from "./types";

export const PROMPTS: Record<string, string[]> = {
  clarity: ["What's taking up space in your head?", "What would you tell a friend?"],
  mood: ["How are you really feeling today, and why?", "What lifted or dragged your mood today?"],
  hard: ["What's been hard lately?", "What do you need right now?"],
  ideas: ["What idea keeps coming back to you?", "What did you notice today?"],
  gratitude: ["One good thing that happened today", "Who are you grateful for this week?"],
  any: ["How did today actually go?", "What are you avoiding?", "How's your body feeling?",
        "What do you want tomorrow to look like?", "What's something you're proud of lately?"],
};

export const GOALS: [string, string][] = [
  ["clarity", "Clear my head"], ["mood", "Understand my moods"], ["hard", "Process hard days"],
  ["ideas", "Capture thoughts on the go"], ["gratitude", "Practise gratitude"], ["any", "Just curious"],
];

/** Three prompts for Home. They follow the goals picked in onboarding and never shuffle. */
export function defaultPrompts(profile?: Profile): string[] {
  const picked = (profile?.goals ?? []).flatMap((g) => PROMPTS[g] ?? []);
  return [...new Set([...picked, "How did today actually go?", "What's taking up space in your head?", "What's one good thing from today?"])].slice(0, 3);
}

export const MOODS = [
  { v: 1, label: "Low", color: "#9A97C9" },
  { v: 2, label: "Meh", color: "#AEB9D6" },
  { v: 3, label: "Okay", color: "#C9D9E3" },
  { v: 4, label: "Good", color: "#9FD3E6" },
  { v: 5, label: "Great", color: "#8C7BEA" },
];
export const moodColor = (v: number | null | undefined) => MOODS.find((m) => m.v === v)?.color ?? "var(--hairline)";

const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
export function dayLabel(iso: string) {
  const d = new Date(iso), today = new Date(), yest = new Date(Date.now() - 864e5);
  if (sameDay(d, today)) return "Today";
  if (sameDay(d, yest)) return "Yesterday";
  const opts: Intl.DateTimeFormatOptions = { weekday: "long", day: "numeric", month: "long" };
  if (d.getFullYear() !== today.getFullYear()) opts.year = "numeric";
  return d.toLocaleDateString(undefined, opts);
}
export const timeLabel = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
export const shortDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });

export function salutation() {
  const h = new Date().getHours();
  return h < 5 ? "Still up" : h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export function greeting(name?: string) {
  const h = new Date().getHours();
  const part = h < 5 ? "Still up" : h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  return name ? `${part}, ${name.split(" ")[0]}` : part;
}
