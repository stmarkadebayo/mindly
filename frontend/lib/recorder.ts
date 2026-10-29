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

  constructor(private hooks: { onTick?: (s: number) => void; onAutoStop?: (reason: StopReason) => void } = {}) {}

  async start(): Promise<MediaStream> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch (err) {
      const name = (err as DOMException)?.name;
      if (name === "NotAllowedError" || name === "SecurityError") throw new MicDeniedError();
      throw err;
    }
    this.chunks = [];
    // A modest bitrate is plenty for speech and keeps the upload (the slowest part on mobile data) small.
    this.recorder = new MediaRecorder(this.stream, { audioBitsPerSecond: 32000 });
    this.recorder.ondataavailable = (e) => e.data.size && this.chunks.push(e.data);
    this.recorder.start(1000); // collect every second so an interruption loses at most a moment
    this.elapsedBefore = 0;
    this.startedAt = Date.now();
    this.tick = setInterval(() => {
      const s = this.seconds();
      this.hooks.onTick?.(s);
      if (s >= MAX_SECONDS) this.hooks.onAutoStop?.("limit");
    }, 250);
    // A phone call, unplugged headset or revoked permission ends the track: keep what we have.
    this.stream.getAudioTracks().forEach((t) => (t.onended = () => this.hooks.onAutoStop?.("interrupted")));
    return this.stream;
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
    this.stream?.getTracks().forEach((t) => {
      t.onended = null;
      t.stop();
    });
  }
}

export const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
