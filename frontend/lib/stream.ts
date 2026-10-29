// Reads the companion's reply as it is written, so the first words show up in about a second rather than after
// the whole reply is done.
import { ApiError } from "./api";

export interface CompanionResult { reply: string; sources: string[]; support: boolean }

/** Citation markers like [#2] are hidden while the reply streams (and a half-typed one at the end). The checked reply replaces the draft when it finishes. */
const hideCitations = (t: string) => t.replace(/\s*\[#\d+\]/g, "").replace(/\s*\[#?\d*$/, "");

export async function streamCompanion(body: unknown, onDraft: (text: string) => void): Promise<CompanionResult> {
  let res: Response;
  try {
    res = await fetch("/api/companion/stream", {
      method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError("You're offline.", 0, true);
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) window.dispatchEvent(new Event("mindly:signed-out"));
    throw new ApiError(data.detail || "Something went wrong.", res.status);
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "", draft = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    for (let nl = buffer.indexOf("\n"); nl >= 0; nl = buffer.indexOf("\n")) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line) continue;
      const event = JSON.parse(line);
      if (event.t === "delta") { draft += event.v; onDraft(hideCitations(draft)); }
      else if (event.t === "reset") { draft = ""; onDraft(""); }
      else if (event.t === "error") throw new ApiError(event.v);
      else if (event.t === "final") return { reply: event.reply, sources: event.sources, support: event.support };
    }
  }
  throw new ApiError("The reply was cut short. Please try again.");
}
