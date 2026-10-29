"use client";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";

export type ListKind = "check" | "bullet" | "number" | "star";
const KEY = "mindly-tools-pos";

/** A small floating toolbar for the note: expands on tap, and can be dragged anywhere on the screen. */
export function NoteTools({ onList, onImage, onDivider, onStamp, onStyle }: { onStyle: (k: "bold" | "italic" | "heading") => void; onList: (k: ListKind) => void; onImage: (f: File) => void; onDivider: () => void; onStamp: () => void }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const drag = useRef<{ dx: number; dy: number; moved: boolean } | null>(null);

  useEffect(() => {
    try { const v = JSON.parse(localStorage.getItem(KEY) || "null"); if (v) setPos(clamp(v.x, v.y)); } catch { /* default position */ }
    const fit = () => setPos((p) => (p ? clamp(p.x, p.y) : p));
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Stay inside the app's own margins: the screen column, not the whole window.
  const bounds = () => {
    const col = box.current?.closest("main")?.querySelector(".page, .recede") as HTMLElement | null;
    const r = col?.getBoundingClientRect();
    const left = Math.max(r?.left ?? 0, 0), right = Math.min(r?.right ?? innerWidth, innerWidth);
    return { left: left + 16, right: right - 16 };
  };
  const clamp = (x: number, y: number) => {
    const b = box.current?.getBoundingClientRect();
    const w = b?.width ?? 44, h = b?.height ?? 44, f = bounds();
    return { x: Math.min(Math.max(f.left, x), Math.max(f.left, f.right - w)), y: Math.min(Math.max(72, y), innerHeight - h - 16) };
  };
  const down = (e: React.PointerEvent) => {
    const b = box.current!.getBoundingClientRect();
    drag.current = { dx: e.clientX - b.left, dy: e.clientY - b.top, moved: false };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const move = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    if (!d.moved && Math.hypot(e.movementX, e.movementY) < 1) return;
    d.moved = true;
    setPos(clamp(e.clientX - d.dx, e.clientY - d.dy));
  };
  const up = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (!d.moved) { setOpen((o) => !o); setTimeout(() => setPos((p) => (p ? clamp(p.x, p.y) : p)), 0); }
    else try { localStorage.setItem(KEY, JSON.stringify(pos)); } catch { /* not saved */ }
  };

  return (
    <div ref={box} className={`note-tools glass chrome${open ? " open" : ""}`}
      style={pos ? { left: pos.x, top: pos.y, right: "auto", bottom: "auto" } : undefined} role="toolbar" aria-label="Note tools" onMouseDown={(e) => e.preventDefault()}>
      <button className="grip" aria-label={open ? "Close note tools (drag to move)" : "Open note tools (drag to move)"} aria-expanded={open}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
        <Icon name={open ? "close" : "compose"} />
      </button>
      {open && <>
        <button aria-label="Heading" onClick={() => onStyle("heading")}><span className="tx" style={{ fontWeight: 700 }}>H</span></button>
        <button aria-label="Bold" onClick={() => onStyle("bold")}><span className="tx" style={{ fontWeight: 800 }}>B</span></button>
        <button aria-label="Italic" onClick={() => onStyle("italic")}><span className="tx" style={{ fontStyle: "italic", fontFamily: "serif" }}>I</span></button>
        <button aria-label="Checklist" onClick={() => onList("check")}><Icon name="check" /></button>
        <button aria-label="Bulleted list" onClick={() => onList("bullet")}><Icon name="list" /></button>
        <button aria-label="Numbered list" onClick={() => onList("number")}><span className="tx">1.</span></button>
        <button aria-label="Mark as important" onClick={() => onList("star")}><span className="tx">★</span></button>
        <button aria-label="Divider" onClick={onDivider}><span className="tx">—</span></button>
        <button aria-label="Add date and time" onClick={onStamp}><span className="tx">⏱</span></button>
        <button aria-label="Add a photo" onClick={() => file.current?.click()}><Icon name="image" /></button>
        <input ref={file} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onImage(f); e.target.value = ""; }} />
      </>}
    </div>
  );
}
