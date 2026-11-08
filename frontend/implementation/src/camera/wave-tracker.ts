/**
 * Wake-up wave detector shared by GlobalCamera and CameraIntro.
 *
 * Owns exactly one HandLandmarker + one rAF loop. Guarantees:
 * - start()/stop() are race-safe (a landmarker that finishes loading after
 *   stop() is closed, never leaked; double start() is a no-op);
 * - detectForVideo is wrapped: 3 consecutive throws end the loop and report a
 *   short Indonesian reason instead of silently dying;
 * - no inference while document.hidden, none when video.currentTime is unchanged;
 * - after the wave is reported the loop and landmarker are released at once.
 */
import type { HandLandmarker } from "@mediapipe/tasks-vision";
import { createHandLandmarker, delegateLabel } from "./hand-landmarker";
import { classifyCameraError, messageFor, type CameraFailureReason } from "./messages";

export interface WaveSample {
  x: number;
  time: number;
}

/** Pure wake-up wave rule: wide horizontal sweep within 1.3 s that returns near its start. */
export function detectWave(samples: WaveSample[]): boolean {
  if (samples.length < 8) return false;
  const values = samples.map((s) => s.x);
  const first = values[0]!;
  const last = values[values.length - 1]!;
  const span = Math.max(...values) - Math.min(...values);
  return span > 0.22 && Math.abs(last - first) < 0.18;
}

export type WaveTrackerStatus =
  | { kind: "ready"; delegate: string }
  | { kind: "error"; reason: CameraFailureReason; message: string };

export interface WaveTrackerOptions {
  getVideo(): HTMLVideoElement | null;
  modelUrl(): string;
  wasmRoot?: string;
  onWave(): void;
  onStatus?(status: WaveTrackerStatus): void;
}

const MAX_CONSECUTIVE_DETECT_FAILURES = 3;
const WINDOW_MS = 1300;

export class WaveTracker {
  private landmarker: HandLandmarker | null = null;
  private rafId: number | null = null;
  private generation = 0;
  private starting = false;
  private reported = false;
  private lastVideoTime = -1;
  private failures = 0;
  private samples: WaveSample[] = [];

  constructor(private readonly options: WaveTrackerOptions) {}

  /** True while a landmarker exists or is being created. */
  get active(): boolean {
    return this.starting || this.landmarker !== null || this.reported;
  }

  async start(): Promise<void> {
    if (this.active) return;
    const gen = ++this.generation;
    this.starting = true;
    try {
      const created = await createHandLandmarker({
        wasmRoot: this.options.wasmRoot ?? "/mediapipe/wasm",
        modelUrl: this.options.modelUrl(),
      });
      if (gen !== this.generation) {
        // stop() (or a newer start) happened while loading: close, never leak.
        try { created.landmarker.close(); } catch { /* best-effort */ }
        return;
      }
      this.landmarker = created.landmarker;
      this.samples = [];
      this.failures = 0;
      this.lastVideoTime = -1;
      this.options.onStatus?.({ kind: "ready", delegate: delegateLabel(created) });
      this.loop();
    } catch (err) {
      if (gen !== this.generation) return;
      // The camera preview stays usable; the wave detector is optional.
      const reason = classifyCameraError(err);
      this.options.onStatus?.({ kind: "error", reason: "model-error", message: messageFor(reason === "tracker-error" ? "model-error" : reason) });
    } finally {
      if (gen === this.generation) this.starting = false;
    }
  }

  stop(): void {
    this.generation++;
    this.starting = false;
    this.reported = false;
    this.release();
    this.samples = [];
    this.lastVideoTime = -1;
    this.failures = 0;
  }

  private release(): void {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    const lm = this.landmarker;
    this.landmarker = null;
    try {
      lm?.close();
    } catch {
      /* best-effort */
    }
  }

  private loop = (): void => {
    const video = this.options.getVideo();
    const landmarker = this.landmarker;
    if (!video || !landmarker || this.reported) return;
    this.rafId = requestAnimationFrame(this.loop);
    if (typeof document !== "undefined" && document.hidden) return;
    if (video.readyState < 2 || video.currentTime === this.lastVideoTime) return;
    this.lastVideoTime = video.currentTime;
    let result;
    try {
      result = landmarker.detectForVideo(video, performance.now());
      this.failures = 0;
    } catch {
      this.failures++;
      if (this.failures >= MAX_CONSECUTIVE_DETECT_FAILURES) {
        this.release();
        this.options.onStatus?.({ kind: "error", reason: "tracker-error", message: messageFor("tracker-error") });
      }
      return;
    }
    const wrist = result.landmarks[0]?.[0];
    if (!wrist) {
      this.samples = [];
      return;
    }
    const now = performance.now();
    this.samples.push({ x: wrist.x, time: now });
    while (this.samples.length && now - this.samples[0]!.time > WINDOW_MS) this.samples.shift();
    if (detectWave(this.samples)) {
      this.reported = true;
      this.release();
      this.options.onWave();
    }
  };
}
