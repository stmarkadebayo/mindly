"use client";
import { useEffect, useRef } from "react";
import { OrbEngine } from "@/lib/orb";

/**
 * The orb. Pass a live MediaStream and it reacts to the speaker's frequencies.
 * `thinking` swirls it on its own, for moments when Mindly is working (writing a page, composing a reply).
 */
export function Orb({ stream, paused = false, thinking = false, idle = 1, pad = 1, className, style }: {
  stream?: MediaStream | null; paused?: boolean; thinking?: boolean; idle?: number;
  /** Draw on a canvas this many times larger than the orb, so its glow has room to fade out. */
  pad?: number; className?: string; style?: React.CSSProperties;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const engine = useRef<OrbEngine | null>(null);

  useEffect(() => {
    engine.current = new OrbEngine(canvas.current!, idle, pad);
    return () => engine.current?.destroy();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (stream) engine.current?.listen(stream);
    else engine.current?.stopListening();
  }, [stream]);

  useEffect(() => engine.current?.mute(paused), [paused]);
  useEffect(() => engine.current?.setThinking(thinking), [thinking]);

  return <canvas ref={canvas} className={className} style={pad > 1
      ? { display: "block", width: `${pad * 100}%`, height: `${pad * 100}%`, maxWidth: "none", margin: `${-(pad - 1) * 50}%`, pointerEvents: "none", ...style }
      : { display: "block", width: "100%", height: "100%", ...style }} aria-hidden="true" />;
}
