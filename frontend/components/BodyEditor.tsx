"use client";
import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from "react";
import { type Part, imgToken, join, parse } from "@/lib/text";
import type { ListKind } from "@/components/NoteTools";

export type StyleKind = "bold" | "italic" | "heading";
export interface BodyHandle { style(kind: StyleKind): void; list(kind: ListKind): void; insertImage(id: string): void; insertText(text: string): void }

const MARKS = ["☐ ", "☑ ", "• ", "★ "];
const lineAt = (text: string, pos: number) => {
  const start = text.lastIndexOf("\n", pos - 1) + 1;
  const end = text.indexOf("\n", pos);
  return { start, end: end < 0 ? text.length : end };
};
const numbered = /^(\d+)\. /;

/** Light formatting kept as plain text: # heading, ## subheading, **bold**, _italic_. Shown styled when you're not editing it. */
function styled(text: string) {
  const inline = (line: string, key: number) =>
    line.split(/(\*\*[^*\n]+\*\*|_[^_\n]+_)/g).map((t, i) =>
      t.startsWith("**") && t.endsWith("**") && t.length > 4 ? <strong key={`${key}-${i}`}>{t.slice(2, -2)}</strong>
      : t.startsWith("_") && t.endsWith("_") && t.length > 2 ? <em key={`${key}-${i}`}>{t.slice(1, -1)}</em> : t);
  return text.split("\n").map((line, i) => {
    const h = /^(#{1,2}) (.*)$/.exec(line);
    return h ? <div key={i} className={h[1].length === 1 ? "md-h1" : "md-h2"}>{inline(h[2], i)}</div>
      : <div key={i} className="md-line">{line ? inline(line, i) : "\u00a0"}</div>;
  });
}

/** The entry text: runs of text with photos between them. Text keeps flowing under a photo. */
export const BodyEditor = forwardRef<BodyHandle, {
  value: string; onChange: (v: string) => void; onBlur: () => void; className: string; placeholder: string;
  urls: Record<string, string>; onOpenImage: (id: string) => void;
}>(function BodyEditor({ value, onChange, onBlur, className, placeholder, urls, onOpenImage }, ref) {
  const parts = parse(value);
  const areas = useRef<(HTMLTextAreaElement | null)[]>([]);
  const last = useRef(0);          // the text run the cursor was last in
  const caretAt = useRef<{ i: number; pos: number } | null>(null);
  const [active, setActive] = useState<number | null>(null);   // the text run being edited; the rest show styled
  const pending = useRef<(() => void) | null>(null);           // a tool tapped before any text was being edited

  const setText = (i: number, text: string) => onChange(join(parts.map((p, k) => (k === i ? { text } : p))));

  useLayoutEffect(() => {
    areas.current.forEach((el) => { if (el) { el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; } });
    const c = caretAt.current;
    if (c) { caretAt.current = null; const el = areas.current[c.i]; if (el) { el.focus(); el.setSelectionRange(c.pos, c.pos); } }
    const again = pending.current;   // the first tap only opened the text for editing; now do what was asked
    if (again && areas.current.some(Boolean)) { pending.current = null; again(); }
  });
  useEffect(() => { const fit = () => areas.current.forEach((el) => { if (el) { el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; } }); window.addEventListener("resize", fit); return () => window.removeEventListener("resize", fit); }, []);

  const target = () => {
    let i = last.current;
    if (!areas.current[i]) i = areas.current.findLastIndex(Boolean);
    const el = areas.current[i];
    return el ? { i, el, pos: el.selectionStart ?? el.value.length } : null;   // null: nothing is being edited
  };
  const noEdit = (retry: () => void) => { // nothing is being edited: open the end of the text for editing, then redo the tap
    let k = parts.length - 1;
    while (k > 0 && "img" in parts[k]) k--;
    const p = parts[k] as { text: string };
    caretAt.current = { i: k, pos: p.text.length };
    pending.current = retry;
    setActive(k);
  };

  const api: BodyHandle = {
    style(kind) {
      const t = target(); if (!t) return noEdit(() => api.style(kind));
      const { i, el, pos } = t;
      const text = el.value, a = el.selectionStart ?? pos, b = el.selectionEnd ?? pos;
      if (kind === "heading") {
        const { start, end } = lineAt(text, a);
        const line = text.slice(start, end), m = /^(#{1,2}) /.exec(line);
        const next = !m ? "# " : m[1].length === 1 ? "## " : "";
        caretAt.current = { i, pos: Math.max(start, a + next.length - (m ? m[0].length : 0)) };
        setText(i, text.slice(0, start) + next + line.slice(m ? m[0].length : 0) + text.slice(end));
        return;
      }
      const mk = kind === "bold" ? "**" : "_";
      if (a === b) {   // nothing selected: style the word at the cursor, so a tap never leaves stray markers behind
        const isWord = (c: string | undefined) => !!c && /[\p{L}\p{M}\p{N}'’-]/u.test(c);
        let ws = a, we = a;
        while (ws > 0 && isWord(text[ws - 1])) ws--;
        while (we < text.length && isWord(text[we])) we++;
        if (we > ws) {
          const wrapped = text.slice(ws - mk.length, ws) === mk && text.slice(we, we + mk.length) === mk;
          if (wrapped) {
            caretAt.current = { i, pos: we - mk.length };
            setText(i, text.slice(0, ws - mk.length) + text.slice(ws, we) + text.slice(we + mk.length));
          } else {
            caretAt.current = { i, pos: we + mk.length * 2 };
            setText(i, text.slice(0, ws) + mk + text.slice(ws, we) + mk + text.slice(we));
          }
          return;
        }
      }
      const sel = text.slice(a, b);
      if (sel.startsWith(mk) && sel.endsWith(mk) && sel.length >= mk.length * 2) {
        caretAt.current = { i, pos: b - mk.length * 2 };
        setText(i, text.slice(0, a) + sel.slice(mk.length, -mk.length) + text.slice(b));
      } else {
        caretAt.current = { i, pos: a === b ? a + mk.length : b + mk.length * 2 };
        setText(i, text.slice(0, a) + mk + sel + mk + text.slice(b));
      }
    },
    list(kind) {
      const t = target(); if (!t) return noEdit(() => api.list(kind));
      const { i, el, pos } = t;
      const text = el.value;
      const { start, end } = lineAt(text, pos);
      const line = text.slice(start, end);
      const num = numbered.exec(line);
      const mark = num ? num[0] : MARKS.find((m) => line.startsWith(m)) ?? "";
      const rest = line.slice(mark.length);
      const next = kind === "check" ? (mark === "☐ " ? "☑ " : mark === "☑ " ? "" : "☐ ")
        : kind === "bullet" ? (mark === "• " ? "" : "• ")
        : kind === "number" ? (num ? "" : "1. ")
        : (mark === "★ " ? "" : "★ ");
      caretAt.current = { i, pos: start + next.length + Math.max(0, Math.min(pos - start - mark.length, rest.length)) };
      setText(i, text.slice(0, start) + next + rest + text.slice(end));
    },
    insertText(add) {
      const t = target(); if (!t) return noEdit(() => api.insertText(add));
      const { i, el, pos } = t;
      const text = el.value, { end } = lineAt(text, pos);
      const at = text.slice(0, end).trim() ? end : pos;     // after the current line, or right here if it's empty
      const ins = (at === end && text.slice(0, end).trim() ? "\n" : "") + add;
      caretAt.current = { i, pos: at + ins.length };
      setText(i, text.slice(0, at) + ins + text.slice(at));
    },
    insertImage(id) {
      const t = target();
      if (!t) { onChange(join([...parts.slice(0, -1), parts[parts.length - 1], { img: id }, { text: "" }])); caretAt.current = { i: parts.length + 1, pos: 0 }; return; }
      const { i, el, pos } = t;
      const text = el.value, { end } = lineAt(text, pos);
      const before = text.slice(0, end), after = text.slice(end + 1);   // the photo goes on the row below the cursor
      const next: Part[] = [...parts.slice(0, i), { text: before }, { img: id }, { text: after }, ...parts.slice(i + 1)];
      caretAt.current = { i: i + 2, pos: 0 };
      onChange(join(next));
    },
  };
  useImperativeHandle(ref, () => api);

  const key = (e: React.KeyboardEvent<HTMLTextAreaElement>, i: number) => {
    const el = e.currentTarget, text = el.value, caret = el.selectionStart;
    if (e.key === "Backspace" && caret === 0 && el.selectionEnd === 0 && i > 0 && "img" in parts[i - 1]) {
      // Backspace at the top of the text below a photo removes the photo.
      e.preventDefault();
      const id = (parts[i - 1] as { img: string }).img;
      onChange(join([...parts.slice(0, i - 1), { text: (parts[i - 2] as { text: string }).text + "\n" + text }, ...parts.slice(i + 1)]).replace(imgToken(id), ""));
      return;
    }
    if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing || caret !== el.selectionEnd) return;
    const { start, end } = lineAt(text, caret);
    const line = text.slice(start, end);
    const num = numbered.exec(line);
    const mark = num ? num[0] : MARKS.find((m) => line.startsWith(m));
    if (!mark || caret < start + mark.length) return;
    e.preventDefault();
    if (line.trim() === mark.trim()) {
      caretAt.current = { i, pos: start };
      setText(i, text.slice(0, start) + text.slice(end));
    } else {
      const add = "\n" + (num ? `${Number(num[1]) + 1}. ` : mark === "• " ? "• " : mark === "★ " ? "" : "☐ ");
      caretAt.current = { i, pos: caret + add.length };
      setText(i, text.slice(0, caret) + add + text.slice(caret));
    }
  };
  const tap = (e: React.MouseEvent<HTMLTextAreaElement>, i: number) => {
    const el = e.currentTarget, text = el.value, pos = el.selectionStart;
    if (pos !== el.selectionEnd) return;
    const { start } = lineAt(text, pos);
    if (pos > start + 1 || !(text[start] === "☐" || text[start] === "☑")) return;
    setText(i, text.slice(0, start) + (text[start] === "☐" ? "☑" : "☐") + text.slice(start + 1));
  };

  return (
    <>
      {parts.map((p, i) => "img" in p ? (
        urls[p.img]
          // eslint-disable-next-line @next/next/no-img-element
          ? <button key={`i${p.img}`} className="inline-photo" onClick={() => onOpenImage(p.img)} aria-label="Photo"><img src={urls[p.img]} alt="" /></button>
          : <span key={`i${p.img}`} className="inline-photo ph" />
      ) : (i === active || !p.text ? (
        <textarea key={`t${i}`} ref={(el) => { areas.current[i] = el; }} className={className} aria-label="Entry text" value={p.text}
          placeholder={parts.length === 1 ? placeholder : i === parts.length - 1 ? "Keep writing…" : ""}
          onFocus={() => { last.current = i; setActive(i); }} onSelect={() => { last.current = i; }}
          onChange={(e) => setText(i, e.target.value)} onKeyDown={(e) => key(e, i)} onClick={(e) => tap(e, i)}
          onBlur={() => { setActive(null); onBlur(); }} />
      ) : (
        <div key={`t${i}`} className={`${className} md`} role="textbox" tabIndex={0} aria-label="Entry text"
          onClick={() => { caretAt.current = { i, pos: p.text.length }; setActive(i); }}
          onFocus={() => { caretAt.current = { i, pos: p.text.length }; setActive(i); }}>{styled(p.text)}</div>
      ))
      )}
    </>
  );
});
