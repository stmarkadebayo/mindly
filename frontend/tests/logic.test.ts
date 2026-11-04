import { describe, expect, it } from "vitest";
import { openCount, openReminders, overdue } from "@/lib/actions";
import { timePrompts, timeSlot } from "@/lib/content";
import { bestStreak, habit } from "@/lib/habit";
import { cached, refresh, reject, rejected } from "@/lib/insights";
import { LEVELS, progress } from "@/lib/level";
import { excerpt, imgToken, join, parse, plain } from "@/lib/text";
import type { Entry, Suggestion } from "@/lib/types";
import { entryOn, serve } from "./helpers";

const days = (...ds: string[]) => ds.map((d) => entryOn(d));

describe("streaks", () => {
  const now = new Date("2026-03-10T18:00:00");
  it("counts consecutive days up to today", () => {
    expect(habit(days("2026-03-08", "2026-03-09", "2026-03-10"), now).streak).toBe(3);
  });
  it("isn't broken by not having written yet today", () => {
    expect(habit(days("2026-03-08", "2026-03-09"), now).streak).toBe(2);
  });
  it("forgives one missed day, but not two", () => {
    expect(habit(days("2026-03-06", "2026-03-07", "2026-03-09", "2026-03-10"), now).streak).toBe(4);
    expect(habit(days("2026-03-06", "2026-03-07", "2026-03-10"), now).streak).toBe(1);
  });
  it("ignores empty and sample entries", () => {
    const empty = entryOn("2026-03-10", "");
    const sample = entryOn("2026-03-09", "words", { sample: true });
    expect(habit([empty, sample], now).streak).toBe(0);
  });
  it("best streak never forgives a gap", () => {
    expect(bestStreak(days("2026-01-01", "2026-01-02", "2026-01-03", "2026-01-05", "2026-01-06"))).toBe(3);
    expect(bestStreak([])).toBe(0);
  });
  it("two entries on one day count as one day", () => {
    expect(bestStreak(days("2026-01-01", "2026-01-01", "2026-01-02"))).toBe(2);
  });
});

describe("levels", () => {
  it("score = words/10 + 20 per day + 15 per day of best streak", () => {
    const hundredWords = Array(100).fill("word").join(" ");
    const p = progress([entryOn("2026-01-01", hundredWords), entryOn("2026-01-02", hundredWords)]);
    expect(p.words).toBe(200);
    expect(p.score).toBe(20 + 2 * 20 + 2 * 15);
    expect(p.name).toBe("First Lines");
    expect(p.next?.name).toBe("Margin Notes");
  });
  it("starts at Blank Page with nothing written", () => {
    const p = progress([]);
    expect(p.score).toBe(0);
    expect(p.name).toBe(LEVELS[0].name);
    expect(p.pct).toBe(0);
  });
  it("photos and hard-to-hear marks don't count as words", () => {
    expect(progress([entryOn("2026-01-01", `${imgToken("abc")}\n⟦two words⟧`)]).words).toBe(2);
  });
  it("tops out at the last level", () => {
    const lots = Array.from({ length: 200 }, (_, i) => entryOn(new Date(2025, 0, 1 + i), "word"));
    const p = progress(lots);
    expect(p.next).toBeNull();
    expect(p.pct).toBe(1);
  });
});

describe("open items come from the entry's own text", () => {
  const reminder = (text: string, status: Suggestion["status"] = "accepted", when?: string): Suggestion =>
    ({ id: text, kind: "reminder", text, status, when } as Suggestion);
  const e = (body: string, suggestions: Suggestion[]) => ({ ...entryOn("2026-01-01", body), suggestions } as Entry);

  it("an accepted reminder is open only while its line is unticked", () => {
    expect(openReminders(e("☐ call mum", [reminder("call mum")]))).toHaveLength(1);
    expect(openReminders(e("☑ call mum", [reminder("call mum")]))).toHaveLength(0);
  });
  it("counts unticked lines plus suggestions waiting for an answer", () => {
    expect(openCount(e("☐ a\n☑ b\n☐ c", [reminder("x", "pending"), reminder("y", "dismissed")]))).toBe(3);
  });
  it("is overdue only once the time has passed", () => {
    expect(overdue(e("☐ pay rent", [reminder("pay rent", "accepted", "2000-01-01T09:00:00")]))).toBe(true);
    expect(overdue(e("☐ pay rent", [reminder("pay rent", "accepted", "2999-01-01T09:00:00")]))).toBe(false);
  });
});

describe("text", () => {
  it("plain text drops photos, shaky marks and extra blank lines", () => {
    expect(plain(`Hello\n${imgToken("p1")}\n\n\n\n⟦world⟧`)).toBe("Hello\n\nworld");
  });
  it("parse and join round-trip a body with photos", () => {
    const body = `before\n${imgToken("p1")}\nafter`;
    expect(join(parse(body))).toBe(body);
    expect(parse(body).filter((p) => "img" in p)).toEqual([{ img: "p1" }]);
  });
  it("excerpts strip formatting and cut at a word", () => {
    expect(excerpt("# Title\n☐ **bold** _it_")).toBe("Title bold it");
    const cut = excerpt("word ".repeat(40), 30);
    expect(cut.endsWith("…")).toBe(true);
    expect(cut.length).toBeLessThanOrEqual(31);
  });
});

describe("prompts", () => {
  it("follow the time of day", () => {
    expect(timeSlot(new Date("2026-03-10T07:00:00"))).toBe("morning");
    expect(timeSlot(new Date("2026-03-10T13:00:00"))).toBe("day");
    expect(timeSlot(new Date("2026-03-10T19:00:00"))).toBe("evening");
    expect(timeSlot(new Date("2026-03-10T02:00:00"))).toBe("night");
  });
  it("are always three, distinct, and include one from a chosen goal", () => {
    const d = new Date("2026-03-10T19:00:00");
    const plainSet = timePrompts(undefined, d);
    expect(plainSet).toHaveLength(3);
    expect(new Set(plainSet).size).toBe(3);
    const withGoal = timePrompts({ goals: ["gratitude"] } as never, d);
    expect(withGoal.some((p) => ["One good thing that happened today", "Who are you grateful for this week?"].includes(p))).toBe(true);
  });
  it("don't change within a day", () => {
    expect(timePrompts(undefined, new Date("2026-03-10T18:00:00"))).toEqual(timePrompts(undefined, new Date("2026-03-10T20:00:00")));
  });
});

describe("insights stay steady", () => {
  const reading = { headline: "h", themes: [{ label: "Work", ids: [] }], noticed: [], try: "?" };
  const three = [entryOn("2026-01-01", "one"), entryOn("2026-01-02", "two"), entryOn("2026-01-03", "three")];

  it("waits for three written entries", async () => {
    const calls = serve({ "/api/insights": () => reading });
    expect(await refresh("u1", three.slice(0, 2))).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it("makes one reading, then reuses it until three new entries arrive", async () => {
    const calls = serve({ "/api/insights": () => reading });
    expect(await refresh("u2", three)).toEqual(reading);
    expect(cached("u2")).toEqual(reading);
    const plusTwo = [...three, entryOn("2026-01-04", "four"), entryOn("2026-01-05", "five")];
    await refresh("u2", plusTwo);
    expect(calls).toHaveLength(1);
    await refresh("u2", [...plusTwo, entryOn("2026-01-06", "six")]);
    expect(calls).toHaveLength(2);
    expect((calls[1].body as { keep: string[] }).keep).toEqual(["Work"]);
  });

  it("opening the page mid-request shares the same request", async () => {
    const calls = serve({ "/api/insights": () => reading });
    await Promise.all([refresh("u3", three), refresh("u3", three)]);
    expect(calls).toHaveLength(1);
  });

  it("remembers rejected observations and sends them to avoid", async () => {
    reject("u4", "You mention work a lot");
    expect(rejected("u4")).toEqual(["You mention work a lot"]);
    const calls = serve({ "/api/insights": () => reading });
    await refresh("u4", three);
    expect((calls[0].body as { avoid: string[] }).avoid).toEqual(["You mention work a lot"]);
  });
});
