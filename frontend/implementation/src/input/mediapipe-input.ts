import type { HandLandmarker, HandLandmarkerResult } from "@mediapipe/tasks-vision";
import type { Landmark, StrokeStore } from "./types";
import type { HandFailureReason, HandInputStatus } from "./types";
import { evaluateGesture, type CursorState } from "./hand-gesture";
import { mapToCanvas } from "./hand-gesture";
import { PointSmoother } from "./smoothing";
import { getSharedStream, subscribeSharedStream } from "../camera/shared-stream";
import { createHandLandmarker, delegateLabel } from "../camera/hand-landmarker";
import { classifyCameraError, messageFor, type CameraFailureReason } from "../camera/messages";

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
  private alreadyLost = false;
  /** Bumped by every start()/stop(); an async start whose token is stale must not touch state. */
  private generation = 0;
  private unsubscribeStream: (() => void) | null = null;
  private onVisibility: (() => void) | null = null;

  constructor(private readonly options: HandDriverOptions) {}

  async start(): Promise<void> {
    const { onStatus } = this.options;
    this.running = true;
    const myGen = ++this.generation;
    const stale = () => !this.running || this.generation !== myGen;
    try {
      onStatus({ kind: "initializing" });

      // Camera first so permission errors surface before model loading.
      // Zero double camera: bind the LIVE stream published by the persistent
      // GlobalCamera (same lens, no second permission prompt) when available.
      const shared = getSharedStream();
      let stream: MediaStream;
      let owns: boolean;
      if (shared && shared.getVideoTracks().some((t) => t.readyState === "live")) {
        stream = shared;
        owns = false;
      } else {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });
        owns = true;
        if (stale()) {
          // stop() raced getUserMedia: never leave an orphan live camera.
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
      }
      this.stream = stream;
      this.ownsStream = owns;
      if (this.options.video.srcObject !== stream) this.options.video.srcObject = stream;
      await this.options.video.play().catch(() => undefined);
      if (stale()) return;
      this.watchBorrowedStream();

      const created = await createHandLandmarker({
        wasmRoot: this.options.wasmRoot ?? "/mediapipe/wasm",
        modelUrl: this.options.modelUrl,
      });
      if (stale()) {
        // stop() raced the async start: do not leave an orphan landmarker behind.
        try { await created.landmarker.close(); } catch { /* best-effort */ }
        return;
      }
      this.landmarker = created.landmarker;

      onStatus({ kind: "ready", delegate: delegateLabel(created) });
      this.watchVisibility();
      this.loop();
    } catch (err) {
      if (stale()) return; // superseded by stop()/restart: the caller already moved on
      await this.stop();
      this.fail(classifyCameraError(err));
    }
  }

  /** Report a failure with a short Indonesian reason; the caller falls back to pointer. */
  private fail(reason: CameraFailureReason): void {
    this.options.onStatus({ kind: "error", reason: toHandReason(reason), message: messageFor(reason) });
  }

  /** A borrowed stream that ends or is retired (permission revoked, camera unplugged) must not leave a dead driver. */
  private watchBorrowedStream(): void {
    this.unsubscribeStream?.();
    this.unsubscribeStream = null;
    if (this.ownsStream || !this.stream) return;
    const stream = this.stream;
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
    void this.stop().then(() => this.fail("camera-lost"));
  }

  /** Hidden tab: stop doing work and end any stroke so nothing stays "held". */
  private watchVisibility(): void {
    if (typeof document === "undefined" || this.onVisibility) return;
    this.onVisibility = () => {
      if (document.hidden) this.process(undefined, performance.now());
    };
    document.addEventListener("visibilitychange", this.onVisibility);
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
    // Hidden tab: skip inference entirely (rAF is throttled anyway; this also covers occluded windows).
    if (typeof document !== "undefined" && document.hidden) return;
    const now = performance.now();
    if (video.currentTime === this.lastVideoTime) return;
    this.lastVideoTime = video.currentTime;
    let result: HandLandmarkerResult;
    try {
      result = this.landmarker.detectForVideo(video, now);
    } catch {
      // A throwing tracker will keep throwing: end the stroke, stop, and let the caller fall back.
      this.process(undefined, now);
      void this.stop().then(() => this.fail("tracker-error"));
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
      // Repeated "lost" frames while already idle change nothing: skip the redraw (perf).
      if (this.alreadyLost && !this.wasPinched) return;
      this.alreadyLost = true;
      if (store.hasInk() || this.wasPinched) store.endStroke();
      this.wasPinched = false;
      this.smoother.reset();
      onCursor?.(null);
      onStatus({ kind: "tracking-lost" });
      onRender();
      return;
    }

    this.alreadyLost = false;
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
    this.generation++;
    cancelAnimationFrame(this.rafId);
    this.unsubscribeStream?.();
    this.unsubscribeStream = null;
    if (this.onVisibility && typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", this.onVisibility);
    }
    this.onVisibility = null;
    if (this.options.store) this.options.store.endStroke();
    this.options.onCursor?.(null);
    // Only release tracks we opened; a borrowed (shared) stream stays alive
    // for its owner (GlobalCamera) and the next hand-mode session.
    const releasedOwnStream = this.ownsStream;
    if (this.ownsStream) this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.ownsStream = false;
    // The video element is the shared GlobalCamera preview: only detach it when we opened the stream.
    if (releasedOwnStream) this.options.video.srcObject = null;
    const landmarker = this.landmarker;
    this.landmarker = null;
    try {
      await landmarker?.close();
    } catch {
      /* close is best-effort */
    }
    this.smoother.reset();
    this.wasPinched = false;
    this.alreadyLost = false;
  }
}

/** HandFailureReason is the narrower public union; fold the extra camera reasons into it. */
function toHandReason(reason: CameraFailureReason): HandFailureReason {
  switch (reason) {
    case "permission-denied":
    case "model-error":
    case "tracker-error":
      return reason;
    default:
      return "camera-unavailable";
  }
}
