"use strict";

/**
 * TASK 14 — MediaPipe gameplay input driver (real camera only).
 * 
 * PROVISIONAL GESTURE MAPPING (not product-final):
 * - Index fingertip (landmark 8) drives horizontal cursor position for left/right movement
 * - Thumb-index pinch toggles grab/drag (PLACE) in gameplay phase
 * - Mirror x (1-x) exactly once via indexTipNormalized from hand-gesture.ts
 * - Movement zones: left < 0.35, right > 0.65, center stop (0.35–0.65)
 * - Pinch threshold 0.42 reused from hand-gesture.ts for grab/drag PLACE
 * - Jump: false unless the caller opts in with enableJump (then a held pinch = jump; PROVISIONAL)
 * - Hysteresis/debounce live in GameplayGestureFilter (zones 0.35/0.65 enter, 0.40/0.60 leave;
 *   3 stable frames before input after (re)acquiring the hand; tracking loss = instant neutral)
 * 
 * ARCHITECTURE:
 * - Borrows shared camera stream only (getSharedStream) — never opens own camera
 * - Uses detectForVideo on actual video frames (no synthetic fallback)
 * - Single consumer loop via rAF; start()/stop() are idempotent
 * - On tracking loss/error/stalled frame (>~300ms): immediate neutral input output
 * - Cleanup: landmarker.close(), cancel rAF; borrowed video/stream never stopped
 * - Abort async init if stop() called before loading completes
 * 
 * EXPORTS:
 * - GameplayHandDriver class
 * - GameplayFrame type {tracked, cursor, pinched, input}
 * - Status string: "initializing" | "tracking" | "tracking-lost" | "camera-unavailable" | "error"
 */

import type { HandLandmarker, HandLandmarkerResult } from "@mediapipe/tasks-vision";
import type { Landmark } from "./types";
import { getSharedStream, subscribeSharedStream } from "../camera/shared-stream";
import { createHandLandmarker, delegateLabel } from "../camera/hand-landmarker";
import { classifyCameraError, messageFor, type CameraFailureReason } from "../camera/messages";
import { GameplayGestureFilter, type GameplayGestureFrame } from "./gameplay-gesture";

// Re-export frame type for consumers
export type GameplayFrame = GameplayGestureFrame;

export type GameplayStatus = "initializing" | "tracking" | "tracking-lost" | "camera-unavailable" | "error";

/** Extra, optional information next to the plain status string (kept separate so onStatus stays a plain string). */
export interface GameplayDiagnostic {
  /** MediaPipe backend in use, e.g. "GPU" or "CPU (cadangan)". */
  delegate?: string;
  /** Short Indonesian reason (<= 8 words) safe to show a student. Present on failures. */
  message?: string;
  reason?: CameraFailureReason;
}

export interface GameplayHandDriverOptions {
  video: HTMLVideoElement;
  /** Called on every processed frame with gesture data (or neutral on loss) */
  onFrame: (frame: GameplayFrame) => void;
  /** Called on status CHANGES (deduplicated) */
  onStatus: (status: GameplayStatus) => void;
  /** Optional diagnostics: chosen delegate on success, student-safe reason on failure. */
  onDiagnostic?: (info: GameplayDiagnostic) => void;
  /** Treat a held pinch as jump (gameplay phase only; leave false while placing). */
  enableJump?: boolean;
  /** WASM root for FilesetResolver; defaults to /mediapipe/wasm */
  wasmRoot?: string;
  /** Model asset path; defaults to /models/hand_landmarker.task */
  modelUrl?: string;
}

const STALLED_FRAME_THRESHOLD_MS = 300;
const DEFAULT_WASM_ROOT = "/mediapipe/wasm";
const DEFAULT_MODEL_URL = "/models/hand_landmarker.task";

function neutralFrame(): GameplayFrame {
  return { tracked: false, cursor: null, pinched: false, input: { left: false, right: false, jump: false } };
}

export class GameplayHandDriver {
  private landmarker: HandLandmarker | null = null;
  private stream: MediaStream | null = null;
  private rafId = 0;
  private running = false;
  private initAborted = false;
  private lastVideoTime = -1;
  private lastProcessTime = 0;
  private generation = 0;
  private readonly filter: GameplayGestureFilter;
  private lastStatus: GameplayStatus | null = null;
  private neutralReported = false;
  private unsubscribeStream: (() => void) | null = null;
  private onVisibility: (() => void) | null = null;

  constructor(private readonly options: GameplayHandDriverOptions) {
    this.filter = new GameplayGestureFilter({ enableJump: options.enableJump });
  }

  /** Emit status only when it changes (a 60 fps loop must not re-notify React every frame). */
  private setStatus(status: GameplayStatus): void {
    if (status === this.lastStatus) return;
    this.lastStatus = status;
    this.options.onStatus(status);
  }

  private fail(status: "camera-unavailable" | "error", reason: CameraFailureReason): void {
    this.lastStatus = status;
    this.options.onStatus(status);
    this.options.onDiagnostic?.({ reason, message: messageFor(reason) });
  }

  async start(): Promise<void> {
    const { video, wasmRoot = DEFAULT_WASM_ROOT, modelUrl = DEFAULT_MODEL_URL } = this.options;

    // Idempotent: if already running, do nothing
    if (this.running) return;

    this.running = true;
    this.initAborted = false;
    this.lastVideoTime = -1;
    this.lastProcessTime = performance.now();
    this.lastStatus = null;
    this.neutralReported = false;
    this.filter.reset();
    this.generation++;
    const myGen = this.generation;
    const stale = () => this.initAborted || !this.running || this.generation !== myGen;

    try {
      this.setStatus("initializing");

      // Borrow shared stream ONLY — never request new camera access
      const shared = getSharedStream();
      if (!shared || !shared.getVideoTracks().some((t) => t.readyState === "live")) {
        this.running = false;
        this.fail("camera-unavailable", "camera-unavailable");
        return;
      }
      this.stream = shared;
      this.watchStream(shared);

      // Bind video element to borrowed stream (re-assigning the same stream restarts playback)
      if (video.srcObject !== this.stream) video.srcObject = this.stream;
      await video.play().catch(() => undefined);

      // Check if init was aborted while awaiting video play
      if (stale()) {
        await this.cleanupLandmarker();
        return;
      }

      // GPU first, one CPU retry (see camera/hand-landmarker.ts)
      const created = await createHandLandmarker({ wasmRoot, modelUrl });

      // If aborted during createFromOptions, close the created landmarker immediately
      if (stale()) {
        try { created.landmarker.close(); } catch { /* best-effort */ }
        return;
      }
      this.landmarker = created.landmarker;

      this.setStatus("tracking");
      this.options.onDiagnostic?.({ delegate: delegateLabel(created) });
      this.watchVisibility();
      this.loop();
    } catch (err) {
      if (stale()) return; // superseded by stop()/restart: caller already moved on
      const reason = classifyCameraError(err);
      await this.stop();
      this.fail(reason === "camera-unavailable" || reason === "camera-busy" ? "camera-unavailable" : "error", reason);
    }
  }

  async stop(): Promise<void> {
    this.running = false;
    this.initAborted = true;
    this.generation++;
    cancelAnimationFrame(this.rafId);
    this.rafId = 0;
    this.unsubscribeStream?.();
    this.unsubscribeStream = null;
    if (this.onVisibility && typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", this.onVisibility);
    }
    this.onVisibility = null;

    // Output neutral input immediately on stop
    this.options.onFrame(neutralFrame());
    this.filter.reset();

    // Cleanup landmarker
    await this.cleanupLandmarker();

    // Do NOT cleanup video binding - leave borrowed stream intact for shared preview
    this.stream = null;
  }

  /** Camera revoked / unplugged / replaced: neutral input and a clear reason, never a stuck direction. */
  private watchStream(stream: MediaStream): void {
    this.unsubscribeStream?.();
    const tracks = stream.getVideoTracks();
    const onEnded = () => this.onCameraLost();
    tracks.forEach((t) => t.addEventListener?.("ended", onEnded));
    const unsub = subscribeSharedStream((current) => {
      if (current !== stream) this.onCameraLost();
    });
    this.unsubscribeStream = () => {
      unsub();
      tracks.forEach((t) => t.removeEventListener?.("ended", onEnded));
    };
  }

  private onCameraLost(): void {
    if (!this.running) return;
    void this.stop().then(() => this.fail("camera-unavailable", "camera-lost"));
  }

  /** Hidden tab: neutral input immediately (visibilitychange must release held input). */
  private watchVisibility(): void {
    if (typeof document === "undefined" || this.onVisibility) return;
    this.onVisibility = () => {
      if (document.hidden) this.reportNeutral();
    };
    document.addEventListener("visibilitychange", this.onVisibility);
  }

  private reportNeutral(): void {
    this.filter.reset();
    if (!this.neutralReported) {
      this.neutralReported = true;
      this.options.onFrame(neutralFrame());
    }
    this.setStatus("tracking-lost");
  }

  private loop = (): void => {
    if (!this.running) return;

    this.rafId = requestAnimationFrame(this.loop);

    // Hidden tab: no inference, neutral input.
    if (typeof document !== "undefined" && document.hidden) {
      this.lastProcessTime = performance.now();
      this.reportNeutral();
      return;
    }

    const video = this.options.video;
    if (!this.landmarker || video.readyState < 2) {
      this.checkStalledFrame();
      return;
    }

    const now = performance.now();
    // Detect stalled frame: video time not advancing
    if (video.currentTime === this.lastVideoTime) {
      this.checkStalledFrame();
      return;
    }
    this.lastVideoTime = video.currentTime;
    this.lastProcessTime = now;

    let result: HandLandmarkerResult;
    try {
      result = this.landmarker.detectForVideo(video, now);
    } catch {
      this.running = false;
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
      this.lastStatus = "error";
      this.options.onStatus("error");
      this.options.onDiagnostic?.({ reason: "tracker-error", message: messageFor("tracker-error") });
      this.options.onFrame(neutralFrame());
      this.cleanupLandmarkerSync();
      return;
    }

    const landmarks: Landmark[] | undefined = result.landmarks[0];
    const frame = this.filter.update(landmarks, now);
    this.neutralReported = false;
    this.options.onFrame(frame);
    this.setStatus(frame.tracked ? "tracking" : "tracking-lost");
  };

  private checkStalledFrame(): void {
    const now = performance.now();
    if (now - this.lastProcessTime > STALLED_FRAME_THRESHOLD_MS) {
      // Stalled frame - output neutral input immediately (once per stall, not every rAF)
      this.reportNeutral();
    }
  }

  private async cleanupLandmarker(): Promise<void> {
    this.cleanupLandmarkerSync();
  }

  private cleanupLandmarkerSync(): void {
    if (this.landmarker) {
      try {
        this.landmarker.close();
      } catch {
        // best-effort
      }
      this.landmarker = null;
    }
  }
}
