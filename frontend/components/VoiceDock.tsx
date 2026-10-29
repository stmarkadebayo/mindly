"use client";
// The recording orb and its controls. It sits low on the screen; tapping it lifts and grows the orb while the
// parent dims the page (the parent reacts to `onLive`). Used on Home (new entries) and on an entry (continue).
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { clock, MicDeniedError, Recorder, WARN_SECONDS, type Recording } from "@/lib/recorder";
import { MicDenied } from "./Bits";
import { ArrowDown } from "./Hand";
import { Icon } from "./Icon";
import { Orb } from "./Orb";
import { useUI } from "./UI";

export interface VoiceHandle {
  /** Start listening, optionally answering a journaling prompt. */
  start: (opts?: { prompt?: string | null }) => Promise<void>;
}

interface Props {
  /** Called with the finished recording and the prompt (if any) it answers. */
  onRecording: (rec: Recording, prompt: string | null) => void | Promise<void>;
  onLive?: (live: boolean) => void;
  /** Runs just before the microphone opens, e.g. to flush unsaved edits. */
  beforeStart?: () => void | Promise<void>;
  /** Small caption above the orb when idle. */
  hint?: string;
  /** First-run text with a hand-drawn arrow pointing at the orb. Replaces the hint. */
  coach?: string;
  /** Rest the orb over this element (a placeholder in the page) instead of at the bottom of the screen. */
  anchor?: React.RefObject<HTMLElement | null>;
  /** Change this when the page layout changes in a way that moves the anchor without resizing it. */
  anchorKey?: string;
}

export const VoiceDock = forwardRef<VoiceHandle, Props>(function VoiceDock(
  { onRecording, onLive, beforeStart, hint = "Tap to talk", coach, anchor, anchorKey }, ref,
) {
  const { toast, sheet, confirm } = useUI();
  const recorder = useRef<Recorder | null>(null);
  const promptRef = useRef<string | null>(null);
  const [prompt, setPrompt] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const [paused, setPaused] = useState(false);
  const [secs, setSecs] = useState(0);
  const [stream, setStream] = useState<MediaStream | null>(null);

  // Always call the latest handlers, even from timers and unmount cleanup.
  const handlers = useRef({ onRecording, onLive, beforeStart });
  handlers.current = { onRecording, onLive, beforeStart };
  const finishRef = useRef<(reason: string) => void>(() => {});

  // When anchored, follow the placeholder: measure it now, and again whenever the page reflows.
  const [spot, setSpot] = useState<{ ox: number; oy: number; size: number } | null>(null);
  useEffect(() => {
    const el = anchor?.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      // On wide screens the dock is positioned inside the pane beside the sidebar, not the whole window.
      const pane = el.closest<HTMLElement>("[data-pane]");
      const h = pane && getComputedStyle(pane).display !== "contents" ? pane.getBoundingClientRect() : null;
      const left = h?.left ?? 0, width = h?.width ?? innerWidth, bottom = h?.bottom ?? innerHeight;
      setSpot({ ox: r.left + r.width / 2 - (left + width / 2), oy: bottom - (r.top + r.height / 2), size: r.width });
    };
    measure();
    const watcher = new ResizeObserver(measure);
    watcher.observe(el);
    window.addEventListener("resize", measure);
    document.fonts?.ready.then(measure);
    return () => { watcher.disconnect(); window.removeEventListener("resize", measure); };
  }, [anchor, anchorKey]);

  // The first time the orb is placed it should appear there, not glide in from the bottom of the screen.
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    if (!spot || settled) return;
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setSettled(true)));
    return () => cancelAnimationFrame(id);
  }, [spot, settled]);

  const setLiveState = (v: boolean) => { setLive(v); handlers.current.onLive?.(v); };

  const start = async (opts?: { prompt?: string | null }) => {
    if (recorder.current) return;
    const rec = new Recorder({
      onTick: (s) => { setSecs(s); if (s === WARN_SECONDS) toast("One minute left in this recording. You can keep going right after."); },
      onAutoStop: (reason) => finishRef.current(reason),
    });
    recorder.current = rec; // claim the slot first so a double tap can't open two microphones
    try {
      await handlers.current.beforeStart?.();
      const s = await rec.start();
      promptRef.current = opts?.prompt ?? null;
      setPrompt(promptRef.current);
      setStream(s);
      setPaused(false);
      setSecs(0);
      setLiveState(true);
      navigator.vibrate?.(10);
    } catch (err) {
      recorder.current = null;
      if (err instanceof MicDeniedError) sheet((close) => <MicDenied close={close} />, undefined, "alert");
      else toast("Couldn't start the microphone. " + (err as Error).message);
    }
  };

  const finish = async (reason: string) => {
    const rec = recorder.current;
    if (!rec) return;
    recorder.current = null;
    const result = await rec.stop(true);
    setStream(null);
    setLiveState(false);
    if (reason === "limit") toast("That recording reached 15 minutes and was saved. Tap the orb to keep going.");
    if (reason === "interrupted") toast("Recording was interrupted, but everything up to that point was saved.");
    if (!result || result.seconds < 1) { if (reason === "done") toast("That was too short to keep."); return; }
    await handlers.current.onRecording(result, promptRef.current);
  };
  finishRef.current = finish;

  const cancel = async () => {
    const rec = recorder.current;
    if (!rec) return;
    rec.pause();
    setPaused(true);
    if (await confirm({ title: "Discard this recording?", body: "What you just said won't be saved.", action: "Discard", cancel: "Keep recording" })) {
      recorder.current = null;
      await rec.stop(false);
      setStream(null);
      setLiveState(false);
    } else { rec.resume(); setPaused(false); }
  };

  const togglePause = () => {
    const rec = recorder.current;
    if (!rec) return;
    if (rec.state === "recording") { rec.pause(); setPaused(true); } else { rec.resume(); setPaused(false); }
  };

  // Keyboard: while recording, Space pauses or resumes, Enter finishes and Esc discards. On Home, Space starts.
  const keys = useRef({ live, start, cancel, togglePause, finish });
  keys.current = { live, start, cancel, togglePause, finish };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest("input, textarea, select, button, a, [contenteditable]") || document.querySelector(".scrim")) return;
      const k = keys.current;
      if (k.live) {
        if (e.code === "Space") { e.preventDefault(); k.togglePause(); }
        else if (e.key === "Enter") { e.preventDefault(); k.finish("done"); }
        else if (e.key === "Escape") { e.preventDefault(); k.cancel(); }
      } else if (e.code === "Space" && anchor) { e.preventDefault(); k.start(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [anchor]);

  useImperativeHandle(ref, () => ({ start }));
  // Leaving mid-recording keeps what was said.
  useEffect(() => () => { if (recorder.current) finishRef.current("interrupted"); }, []);

  return (
    <>
      <div className={`veil${live ? " on" : ""}`} aria-hidden="true" />
      <div className={`voice${live ? " live" : ""}${anchor ? (spot ? " anchored" : " waiting") : ""}${settled ? " settled" : ""}`}
        style={spot ? ({ "--ox": `${spot.ox}px`, "--oy": `${spot.oy}px`, "--as": `${spot.size}px` } as React.CSSProperties) : undefined}>
        {coach && !live && (
          <div className="coach"><span className="hand">{coach}</span><ArrowDown size={36} /></div>
        )}
        <div className="listening" aria-live="polite">
          <span className="hand">{live ? (paused ? "Paused" : "I'm listening") : ""}</span>
          {live && prompt && <span className="prompt">{prompt}</span>}
          {live && <small>Tap the orb to pause · ✓ to finish<span className="kbd-hint"> · Space pauses, Esc discards</span></small>}
        </div>
        <button className="orb-btn" aria-label={live ? (paused ? "Resume recording" : "Pause recording") : "Start talking"} onClick={() => { if (live) togglePause(); else start(); }}>
          <Orb stream={stream} paused={paused} idle={live ? 0.6 : 1.2} pad={1.7} />
        </button>
        {!coach && hint && <span className="hint">{hint}</span>}
        <div className="controls glass" role="group" aria-label="Recording controls">
          <button className="icon-btn" aria-label="Discard recording" onClick={cancel}><Icon name="close" /></button>
          <span className="clock">{clock(secs)}</span>
          <button className="icon-btn" aria-label={paused ? "Resume" : "Pause"} onClick={togglePause}><Icon name={paused ? "play" : "pause"} /></button>
          <button className="icon-btn done" aria-label="Finish recording" onClick={() => finish("done")}><Icon name="check" /></button>
        </div>
      </div>
    </>
  );
});
