// Hand-drawn graphics, original to Mindly. Strokes run through a turbulence filter so edges wobble like ink on paper.

/** SVG filters used by every hand-drawn shape. Rendered once in the root layout. */
export function HandDefs() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
      <defs>
        <filter id="rough" x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="4" />
          <feDisplacementMap in="SourceGraphic" scale="3" />
        </filter>
      </defs>
    </svg>
  );
}

/** Mindly's mark: a handwritten lowercase "m", drawn in three downstrokes with two arches. */
export function Mark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-hidden="true" style={{ flex: "none" }}>
      <g filter="url(#rough)" fill="none" stroke="var(--lavender)" strokeWidth="6.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13 21 L13 50 M13 34 C14 26 20 22 26 24 C31 26 32 31 32 38 L32 50 M32 34 C33 26 39 22 45 24 C50 26 51 31 51 38 L51 50" />
      </g>
    </svg>
  );
}

/** A scribbled underline. Stretches to fit whatever it sits under. */
export function Underline({ width = "100%", color = "var(--lavender)" }: { width?: number | string; color?: string }) {
  return (
    <svg width={width} height="10" viewBox="0 0 160 10" preserveAspectRatio="none" aria-hidden="true" style={{ display: "block" }}>
      <path filter="url(#rough)" d="M3 6 C 40 2, 100 2, 157 5 M 14 8 C 60 5, 110 6, 138 7" stroke={color} strokeWidth="2.6" strokeLinecap="round" fill="none" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** A loose hand-drawn ring, used to mark a choice. */
export function Ring({ color = "var(--lavender)" }: { color?: string }) {
  return (
    <svg viewBox="0 0 100 60" preserveAspectRatio="none" aria-hidden="true"
      style={{ position: "absolute", inset: "-4px -6px", width: "calc(100% + 12px)", height: "calc(100% + 8px)", pointerEvents: "none" }}>
      <path filter="url(#rough)" d="M50 4 C 80 3, 97 14, 96 30 C 95 48, 72 57, 48 56 C 22 55, 4 46, 4 30 C 4 14, 24 5, 56 6"
        stroke={color} strokeWidth="2.2" fill="none" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** A curved hand-drawn arrow pointing down toward the orb. */
export function ArrowDown({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 60 60" aria-hidden="true">
      <g filter="url(#rough)" stroke="var(--muted)" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 6 C 40 12, 44 30, 32 50" />
        <path d="M22 44 L 32 52 L 40 41" />
      </g>
    </svg>
  );
}

/** A few hand-drawn sparkles for the welcome screen. */
export function Sparkles({ className }: { className?: string }) {
  const star = (x: number, y: number, s: number, c: string) => (
    <path key={`${x}${y}`} d={`M${x} ${y - s} L${x} ${y + s} M${x - s} ${y} L${x + s} ${y}`} stroke={c} />
  );
  return (
    <svg viewBox="0 0 120 100" className={className} aria-hidden="true">
      <g filter="url(#rough)" strokeWidth="2.6" strokeLinecap="round" fill="none">
        {star(26, 30, 9, "var(--lavender)")}
        {star(92, 18, 6, "var(--glacier)")}
        {star(70, 70, 8, "var(--lavender)")}
        {star(18, 78, 5, "var(--glacier)")}
      </g>
    </svg>
  );
}
