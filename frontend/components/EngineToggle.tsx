"use client";
// Header switch between the two speech engines, so they can be tried on the same kind of speech without a test set.
// It sits on Home only and stays out of the way: the choice is remembered on this device.
import { useEffect, useState } from "react";
import { setSpeechEngine, speechEngine } from "@/lib/prefs";
import { useSession } from "./Session";
import { useUI } from "./UI";

export function EngineToggle() {
  const { config } = useSession();
  const { toast } = useUI();
  const alt = config.asr_alt;
  const [engine, setEngine] = useState<"whisper" | "alt">("whisper");
  useEffect(() => {
    const sync = () => setEngine(speechEngine());
    sync();
    window.addEventListener("mindly:engine", sync);
    return () => window.removeEventListener("mindly:engine", sync);
  }, []);

  const choose = (e: "whisper" | "alt") => {
    if (e === "alt" && !alt) return toast("NaijaVox isn't connected on this server yet.");
    setSpeechEngine(e);
  };

  return (
    <div className="segmented" role="group" aria-label="Speech engine">
      <button aria-pressed={engine === "whisper"} onClick={() => choose("whisper")}>Whisper</button>
      <button aria-pressed={engine === "alt"} onClick={() => choose("alt")} title={alt ? undefined : "Not connected yet"}
        style={alt ? undefined : { opacity: 0.5 }}>{alt || "NaijaVox"}</button>
    </div>
  );
}
