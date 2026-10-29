"use client";
// App-wide toasts, bottom sheets, alerts and confirmations.
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

type Render = (close: () => void) => ReactNode;
type Kind = "sheet" | "alert";
type Confirm = { title: string; body: string; action: string; cancel?: string; danger?: boolean };

interface UIContext {
  toast: (message: string) => void;
  /** A bottom sheet for content you work in, or (kind "alert") a small centred dialog for a message or a choice. */
  sheet: (render: Render, onClose?: () => void, kind?: Kind) => () => void;
  confirm: (c: Confirm) => Promise<boolean>;
}

const Ctx = createContext<UIContext | null>(null);
export const useUI = () => useContext(Ctx)!;

interface Layer { id: number; render: Render; onClose?: () => void; kind: Kind }

export function UIProvider({ children }: { children: ReactNode }) {
  const [toastText, setToast] = useState<string | null>(null);
  const [layers, setLayers] = useState<Layer[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const nextId = useRef(0);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const toast = useCallback((message: string) => {
    setToast(message);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 3600);
  }, []);

  const sheet = useCallback((render: Render, onClose?: () => void, kind: Kind = "sheet") => {
    const id = nextId.current++;
    setLayers((l) => [...l, { id, render, onClose, kind }]);
    return () => setLayers((l) => {
      l.find((x) => x.id === id)?.onClose?.();
      return l.filter((x) => x.id !== id);
    });
  }, []);

  const confirm = useCallback((c: Confirm) => new Promise<boolean>((resolve) => {
    let answered = false;
    sheet((close) => (
      <>
        <h2>{c.title}</h2>
        <p>{c.body}</p>
        <div className="alert-actions">
          <button className="quiet" onClick={close}>{c.cancel ?? "Cancel"}</button>
          <button className={c.danger === false ? "primary" : "danger"} onClick={() => { answered = true; resolve(true); close(); }}>{c.action}</button>
        </div>
      </>
    ), () => { if (!answered) resolve(false); }, "alert");
  }), [sheet]);

  useEffect(() => {
    if (!layers.length) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeTop(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });
  const closeTop = () => setLayers((l) => { l.at(-1)?.onClose?.(); return l.slice(0, -1); });

  return (
    <Ctx.Provider value={{ toast, sheet, confirm }}>
      {children}
      {mounted && createPortal(
        <>
          {layers.map(({ id, render, onClose, kind }) => {
            const close = () => setLayers((l) => { onClose?.(); return l.filter((x) => x.id !== id); });
            return (
              <div key={id} className={`scrim${kind === "alert" ? " alert" : ""}`} onClick={(e) => e.target === e.currentTarget && close()}>
                {kind === "alert"
                  ? <div className="alert-panel glass" role="alertdialog" aria-modal="true">{render(close)}</div>
                  : <div className="sheet glass" role="dialog" aria-modal="true"><div className="grabber" />{render(close)}</div>}
              </div>
            );
          })}
          {toastText && <div className="toast glass" role="status">{toastText}</div>}
        </>,
        document.body,
      )}
    </Ctx.Provider>
  );
}
