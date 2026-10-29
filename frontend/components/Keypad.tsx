"use client";
import { useEffect, useRef, useState } from "react";

/** A 4-digit PIN pad. onComplete returns whether the PIN was accepted; a wrong PIN shakes and clears. */
export function Keypad({ onComplete }: { onComplete: (pin: string) => Promise<boolean> | boolean }) {
  const [pin, setPin] = useState("");
  const [shake, setShake] = useState(false);

  const current = useRef("");
  const press = (k: string) => {
    const p = current.current;
    const next = k === "del" ? p.slice(0, -1) : p.length < 4 ? p + k : p;
    current.current = next;
    setPin(next);
    if (next.length === 4 && p.length === 3) {
      setTimeout(async () => {
        if (!(await onComplete(next))) { setShake(true); setTimeout(() => setShake(false), 450); }
        current.current = "";
        setPin("");
      }, 120);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (/^\d$/.test(e.key)) press(e.key); if (e.key === "Backspace") press("del"); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  return (
    <div style={{ display: "grid", justifyItems: "center", gap: 24 }}>
      <div className={`pin-dots${shake ? " shake" : ""}`} aria-live="polite" aria-label={`${pin.length} of 4 digits entered`}>
        {[0, 1, 2, 3].map((i) => <i key={i} className={i < pin.length ? "on" : ""} />)}
      </div>
      <div className="keypad">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"].map((k, i) =>
          k === "" ? <span key={i} /> :
          <button key={i} className={k === "del" ? "del" : "glass"} onClick={() => press(k)} aria-label={k === "del" ? "Delete" : k}>
            {k === "del" ? "⌫" : k}
          </button>)}
      </div>
    </div>
  );
}
