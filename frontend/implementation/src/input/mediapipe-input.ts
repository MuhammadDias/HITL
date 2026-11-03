import { FilesetResolver, HandLandmarker, type HandLandmarkerResult } from "@mediapipe/tasks-vision";
import type { Landmark, StrokeStore } from "./types";
import type { HandFailureReason, HandInputStatus } from "./types";
import { evaluateGesture, type CursorState } from "./hand-gesture";
import { mapToCanvas } from "./hand-gesture";
import { PointSmoother } from "./smoothing";
import { getSharedStream } from "../camera/shared-stream";

/**
 * TASK 05 — MediaPipe HandLandmarker drawing driver (client-only).
 *
 * PROVISIONAL gesture: index-finger cursor + thumb-index pinch toggles ink.
 * - Browser-only; never imported on the server (dynamic import at call site).
 * - Starts only when the student enters hand-drawing mode.
 * - Fully cleaned up when leaving drawing mode (camera tracks, rAF, landmarker).
 * - Every failure mode degrades to pointer/touch without app restart.
 */
export interface HandDriverOptions {
  canvas: HTMLCanvasElement;
  video: HTMLVideoElement;
  store: StrokeStore;
  modelUrl: string;
  /** WASM root for FilesetResolver; local copy under /mediapipe/wasm preferred. */
  wasmRoot?: string;
  onStatus(status: HandInputStatus): void;
  onRender(): void;
  onCursor?: (cursor: { x: number; y: number; state: "hover" | "near" | "drawing" } | null) => void;
}

export class HandDrawingDriver {
  private landmarker: HandLandmarker | null = null;
  private stream: MediaStream | null = null;
  /** True only when THIS driver opened the camera (must then close it too). */
  private ownsStream = false;
  private rafId = 0;
  private running = false;
  private lastVideoTime = -1;
  private smoother = new PointSmoother();
  private wasPinched = false;

  constructor(private readonly options: HandDriverOptions) {}

  async start(): Promise<void> {
    const { onStatus } = this.options;
    this.running = true;
    try {
      onStatus({ kind: "initializing" });

      // Camera first so permission errors surface before model loading.
      // Zero double camera: bind the LIVE stream published by the persistent
      // GlobalCamera (same lens, no second permission prompt) when available.
      const shared = getSharedStream();
      if (shared && shared.getVideoTracks().some((t) => t.readyState === "live")) {
        this.stream = shared;
        this.ownsStream = false;
      } else {
        this.stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });
        this.ownsStream = true;
      }
      this.options.video.srcObject = this.stream;
      await this.options.video.play().catch(() => undefined);

      const vision = await FilesetResolver.forVisionTasks(
        this.options.wasmRoot ?? "/mediapipe/wasm",
      );
      this.landmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: this.options.modelUrl, delegate: "GPU" },
        runningMode: "VIDEO",
        numHands: 1,
      });

      onStatus({ kind: "ready" });
      this.loop();
    } catch (err) {
      await this.stop();
      onStatus({ kind: "error", reason: classify(err) });
    }
  }

  /**
   * TEST HOOK ONLY (TASK 14): feeds synthetic landmarks through the same
   * pipeline without a camera. Guarded by NEXT_PUBLIC_TEST_HOOKS in callers.
   */
  feedLandmarksForTest(landmarks: Landmark[] | undefined, timestampMs: number): void {
    if (!this.running) return;
    this.process(landmarks, timestampMs);
  }

  private loop = (): void => {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(this.loop);
    const video = this.options.video;
    if (!this.landmarker || video.readyState < 2) return;
    const now = performance.now();
    if (video.currentTime === this.lastVideoTime) return;
    this.lastVideoTime = video.currentTime;
    let result: HandLandmarkerResult;
    try {
      result = this.landmarker.detectForVideo(video, now);
    } catch {
      this.options.onStatus({ kind: "error", reason: "tracker-error" });
      return;
    }
    this.process(result.landmarks[0], now);
  };

  /** Shared pipeline for camera frames and injected test landmarks. */
  private process(landmarks: Landmark[] | undefined, _timestampMs: number): void {
    const frame = evaluateGesture(landmarks);
    const { store, canvas, onStatus, onRender, onCursor } = this.options;

    if (frame.state === "lost") {
      // End any open stroke so reacquisition never draws jump lines.
      if (store.hasInk() || this.wasPinched) store.endStroke();
      this.wasPinched = false;
      this.smoother.reset();
      onCursor?.(null);
      onStatus({ kind: "tracking-lost" });
      onRender();
      return;
    }

    onStatus({ kind: frame.pinched ? "drawing" : "ready" });
    const smoothed = this.smoother.smooth(frame.cursor, _timestampMs);
    const pt = mapToCanvas(smoothed, canvas.width, canvas.height);
    onCursor?.({ x: pt.x, y: pt.y, state: frame.cursorState });

    if (frame.pinched && !this.wasPinched) {
      store.beginStroke();
      store.addPoint(pt);
    } else if (frame.pinched && this.wasPinched) {
      store.addPoint(pt);
    } else if (!frame.pinched && this.wasPinched) {
      store.addPoint(pt);
      store.endStroke();
    }
    this.wasPinched = frame.pinched;
    onRender();
  }

  async stop(): Promise<void> {
    this.running = false;
    cancelAnimationFrame(this.rafId);
    if (this.options.store) this.options.store.endStroke();
    this.options.onCursor?.(null);
    // Only release tracks we opened; a borrowed (shared) stream stays alive
    // for its owner (GlobalCamera) and the next hand-mode session.
    if (this.ownsStream) this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.ownsStream = false;
    this.options.video.srcObject = null;
    try {
      await this.landmarker?.close();
    } catch {
      /* close is best-effort */
    }
    this.landmarker = null;
    this.smoother.reset();
    this.wasPinched = false;
  }
}

function classify(err: unknown): HandFailureReason {
  const name = err instanceof DOMException ? err.name : "";
  const msg = err instanceof Error ? err.message : String(err);
  if (name === "NotAllowedError") return "permission-denied";
  if (name === "NotFoundError" || name === "OverconstrainedError" || name === "NotReadableError")
    return "camera-unavailable";
  if (/model|asset|fileset/i.test(msg)) return "model-error";
  return "tracker-error";
}
