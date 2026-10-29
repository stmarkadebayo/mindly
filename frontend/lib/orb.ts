// The Mindly orb: a soft iridescent blob drawn on canvas that reacts to the frequencies in the user's voice.
//   bass  (80-300 Hz)  -> size: it swells as you speak
//   mids  (300-2k Hz)  -> edge wobble: the body of your voice moves its shape
//   highs (2k-8k Hz)   -> shimmer and a shift from lavender toward glacier blue on "s"/"t" sounds
// With no input it breathes slowly, drifting between lavender and glacier. Reduced motion keeps it still.

const POINTS = 96;
type Level = { low: number; mid: number; high: number };

export class OrbEngine {
  private ctx: CanvasRenderingContext2D;
  private level: Level = { low: 0, mid: 0, high: 0 };
  private t = Math.random() * 100;
  private raf = 0;
  private observer: ResizeObserver;
  private audio: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private bins: Uint8Array<ArrayBuffer> = new Uint8Array(0);
  private paused = false;
  private thinking = false;
  private still = matchMedia("(prefers-reduced-motion: reduce)");

  /** `scale` > 1 means the canvas is larger than the orb, leaving room for its glow so it never gets clipped square. */
  constructor(private canvas: HTMLCanvasElement, public idle = 1, private scale = 1) {
    this.ctx = canvas.getContext("2d")!;
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(canvas);
    this.resize();
    this.raf = requestAnimationFrame(this.frame);
  }

  private resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const { width, height } = this.canvas.getBoundingClientRect();
    this.canvas.width = Math.max(1, width * dpr);
    this.canvas.height = Math.max(1, height * dpr);
  }

  listen(stream: MediaStream) {
    this.stopListening();
    this.audio = new AudioContext();
    this.analyser = this.audio.createAnalyser();
    this.analyser.fftSize = 1024;
    this.analyser.smoothingTimeConstant = 0.6;
    this.audio.createMediaStreamSource(stream).connect(this.analyser);
    this.bins = new Uint8Array(this.analyser.frequencyBinCount);
    this.paused = false;
  }

  mute(paused: boolean) {
    this.paused = paused;
  }

  /** Swirl on its own, like a held breath, while Mindly is working. */
  setThinking(on: boolean) {
    this.thinking = on;
  }

  stopListening() {
    this.audio?.close().catch(() => {});
    this.audio = this.analyser = null;
  }

  private band(from: number, to: number) {
    const hz = this.audio!.sampleRate / 2 / this.bins.length;
    const a = Math.floor(from / hz), b = Math.min(this.bins.length, Math.ceil(to / hz));
    let sum = 0;
    for (let i = a; i < b; i++) sum += this.bins[i];
    // Subtract a noise floor so room hum doesn't keep the orb puffed up.
    return Math.max(0, sum / ((b - a) * 255) - 0.12) / 0.88;
  }

  private sample() {
    let target: Level = { low: 0, mid: 0, high: 0 };
    if (this.analyser && !this.paused) {
      this.analyser.getByteFrequencyData(this.bins);
      target = { low: this.band(80, 300) * 1.6, mid: this.band(300, 2000) * 1.8, high: this.band(2000, 8000) * 3 };
    } else if (this.thinking) {
      const t = this.t;
      target = { low: 0.22 + 0.08 * Math.sin(t * 2.2), mid: 0.32 + 0.18 * Math.sin(t * 3.1), high: 0.16 + 0.1 * Math.sin(t * 4.3) };
    }
    for (const k of ["low", "mid", "high"] as const) {
      const v = Math.min(1, target[k]), cur = this.level[k];
      this.level[k] = cur + (v - cur) * (v > cur ? 0.35 : 0.07); // fast attack, slow release
    }
  }

  private frame = () => {
    this.raf = requestAnimationFrame(this.frame);
    if (!this.canvas.isConnected) return this.destroy();
    const still = this.still.matches;
    this.t += still ? 0 : 1 / 60;
    this.sample();
    this.draw(still);
  };

  private draw(still: boolean) {
    const { ctx, canvas, t } = this;
    const { low, mid, high } = this.level;
    const w = canvas.width, h = canvas.height, cx = w / 2, cy = h / 2;
    const R = (Math.min(w, h) * 0.36) / this.scale;
    ctx.clearRect(0, 0, w, h);

    const breath = still ? 0 : Math.sin(t * 1.3) * 0.025 * this.idle;
    const pts: [number, number][] = [];
    for (let i = 0; i < POINTS; i++) {
      const a = (i / POINTS) * Math.PI * 2;
      let r = R * (0.86 + breath + low * 0.16);
      if (!still) {
        r += R * (0.018 * this.idle) * Math.sin(2 * a + t * 0.9);
        r += R * mid * 0.13 * (0.6 * Math.sin(3 * a + t * 1.9) + 0.4 * Math.sin(5 * a - t * 2.6));
        r += R * high * 0.05 * Math.sin(11 * a + t * 7);
      }
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }

    const path = new Path2D();
    const mid0 = (p: number[], q: number[]): [number, number] => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
    path.moveTo(...mid0(pts[POINTS - 1], pts[0]));
    for (let i = 0; i < POINTS; i++) {
      const p = pts[i], m = mid0(p, pts[(i + 1) % POINTS]);
      path.quadraticCurveTo(p[0], p[1], m[0], m[1]);
    }
    path.closePath();

    // Iridescence: drift slowly between lavender and glacier; highs push toward glacier.
    const drift = still ? 0.3 : (Math.sin(t * 0.35) + 1) / 2;
    const k = Math.min(1, drift * 0.7 + high * 0.8);
    const energy = Math.min(1, low * 0.5 + mid * 0.4 + high * 0.3);

    ctx.save();
    ctx.shadowColor = rgba(mix(LAV_GLOW, ICE_GLOW, k), 0.35 + energy * 0.35);
    ctx.shadowBlur = R * (0.4 + energy * 0.55);
    const hx = cx - R * 0.35 + Math.sin(t * 0.5) * R * 0.1, hy = cy - R * 0.4 + Math.cos(t * 0.4) * R * 0.08;
    const g = ctx.createRadialGradient(hx, hy, R * 0.05, cx, cy, R * 1.25);
    g.addColorStop(0, rgb(mix([246, 244, 255], [236, 250, 255], k)));
    g.addColorStop(0.42, rgb(mix([178, 164, 246], [150, 214, 238], k)));
    g.addColorStop(1, rgb(mix([110, 92, 222], [72, 160, 206], k)));
    ctx.fillStyle = g;
    ctx.fill(path);
    ctx.restore();

    // A second, opposite-coloured lobe gives the surface depth, like light through glass.
    ctx.save();
    ctx.clip(path);
    const lx = cx + R * 0.45 + Math.cos(t * 0.3) * R * 0.12, ly = cy + R * 0.4;
    const lobe = ctx.createRadialGradient(lx, ly, 0, lx, ly, R * 0.9);
    lobe.addColorStop(0, rgba(mix([150, 214, 238], [190, 176, 250], k), 0.55));
    lobe.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = lobe;
    ctx.fillRect(0, 0, w, h);
    const s = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.45, 0, cx - R * 0.3, cy - R * 0.45, R * 0.8);
    s.addColorStop(0, `rgba(255,255,255,${0.45 + high * 0.2})`);
    s.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = s;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    this.observer.disconnect();
    this.stopListening();
  }
}

const LAV_GLOW = [140, 123, 234], ICE_GLOW = [95, 180, 220];
const mix = (a: number[], b: number[], k: number) => a.map((v, i) => Math.round(v * (1 - k) + b[i] * k));
const rgb = (c: number[]) => `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
const rgba = (c: number[], a: number) => `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${a})`;
