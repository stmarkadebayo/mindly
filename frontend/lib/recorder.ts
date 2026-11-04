// Microphone recording with pause/resume, a hard length cap, and clean handling of interruptions.

export const MAX_SECONDS = 15 * 60;
export const WARN_SECONDS = MAX_SECONDS - 60;

export class MicDeniedError extends Error {}

export interface Recording {
  blob: Blob;
  ext: string;
  seconds: number;
}

type StopReason = "limit" | "interrupted";

export class Recorder {
  private stream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private elapsedBefore = 0;
  private startedAt = 0;
  private tick: ReturnType<typeof setInterval> | undefined;

  private ctx: AudioContext | null = null;
  private level: AnalyserNode | null = null;
  private wave = new Uint8Array(1024);   // reused on every check rather than allocated four times a second
  private loud = 0; // loudest moment so far, 0 to 1
  private warned = false;

  constructor(
    private hooks: { onTick?: (s: number) => void; onAutoStop?: (reason: StopReason) => void; onQuiet?: () => void } = {},
    /** Room mode: record the sound as it arrives. Echo cancellation, noise suppression and auto-gain are built for a phone
     *  held at the mouth and tend to remove a distant speaker as "noise". */
    private room = false,
  ) {}

  async start(): Promise<MediaStream> {
    try {
      const on = !this.room;
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: on, noiseSuppression: on, autoGainControl: on, channelCount: 1 },
      });
    } catch (err) {
      const name = (err as DOMException)?.name;
      if (name === "NotAllowedError" || name === "SecurityError") throw new MicDeniedError();
      throw err;
    }
    this.chunks = [];
    // A modest bitrate is plenty for speech and keeps the upload (the slowest part on mobile data) small.
    // Room speech is faint and echoey, so it gets more bits than a voice held close to the microphone.
    this.recorder = new MediaRecorder(this.stream, { audioBitsPerSecond: this.room ? 64000 : 32000 });
    this.watchLevel(this.stream);
    this.recorder.ondataavailable = (e) => e.data.size && this.chunks.push(e.data);
    this.recorder.start(1000); // collect every second so an interruption loses at most a moment
    this.elapsedBefore = 0;
    this.startedAt = Date.now();
    this.tick = setInterval(() => {
      const s = this.seconds();
      this.hooks.onTick?.(s);
      this.checkLevel(s);
      if (s >= MAX_SECONDS) this.hooks.onAutoStop?.("limit");
    }, 250);
    // A phone call, unplugged headset or revoked permission ends the track: keep what we have.
    this.stream.getAudioTracks().forEach((t) => (t.onended = () => this.hooks.onAutoStop?.("interrupted")));
    return this.stream;
  }

  private watchLevel(stream: MediaStream) {
    this.loud = 0;
    this.warned = false;
    try {
      this.ctx = new AudioContext();
      this.level = this.ctx.createAnalyser();
      this.level.fftSize = 1024;
      this.ctx.createMediaStreamSource(stream).connect(this.level);
    } catch { this.level = null; } // no level check; recording is unaffected
  }

  /** After a few seconds of recording, warn once if the microphone has heard almost nothing. */
  private checkLevel(seconds: number) {
    if (!this.level || this.state !== "recording") return;
    this.level.getByteTimeDomainData(this.wave);
    let peak = 0;
    for (const v of this.wave) peak = Math.max(peak, Math.abs(v - 128) / 128);
    this.loud = Math.max(this.loud, peak);
    if (seconds >= 6 && !this.warned && this.loud < 0.04) {
      this.warned = true;
      this.hooks.onQuiet?.();
    }
  }

  get state(): RecordingState {
    return this.recorder?.state ?? "inactive";
  }

  seconds() {
    const running = this.state === "recording" ? Date.now() - this.startedAt : 0;
    return Math.floor((this.elapsedBefore + running) / 1000);
  }

  pause() {
    if (this.state !== "recording") return;
    this.recorder!.pause();
    this.elapsedBefore += Date.now() - this.startedAt;
  }

  resume() {
    if (this.state !== "paused") return;
    this.recorder!.resume();
    this.startedAt = Date.now();
  }

  /** Stop and return the recording, or null if cancelled or empty. */
  stop(keep = true): Promise<Recording | null> {
    return new Promise((resolve) => {
      const rec = this.recorder;
      if (!rec || rec.state === "inactive") return resolve(null);
      const seconds = this.seconds();
      const type = rec.mimeType || "audio/webm";
      rec.onstop = () => {
        this.cleanup();
        const blob = new Blob(this.chunks, { type });
        if (!keep || !blob.size) return resolve(null);
        const ext = type.includes("mp4") ? "mp4" : type.includes("ogg") ? "ogg" : "webm";
        resolve({ blob, ext, seconds });
      };
      rec.stop();
    });
  }

  private cleanup() {
    clearInterval(this.tick);
    this.ctx?.close().catch(() => {});
    this.ctx = null;
    this.level = null;
    this.stream?.getTracks().forEach((t) => {
      t.onended = null;
      t.stop();
    });
  }
}

export const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
