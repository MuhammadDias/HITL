import type { HandLandmarker, HandLandmarkerResult } from "@mediapipe/tasks-vision";
import { HandGestureStateMachine, type GestureEvaluationResult } from "./hand-gesture";
import { LandmarkSmoother } from "./smoothing";
import type { HandFailureReason, HandInputStatus, Landmark } from "./types";

export interface TrackedHandFrame {
  /** Raw MediaPipe landmark coordinates. Cursor coordinates are mirrored separately. */
  landmarks: Landmark[] | undefined;
  gesture: GestureEvaluationResult;
  /** Mirrored, clamped screen-space normalized index-tip coordinates. */
  cursor: { x: number; y: number };
  timestampMs: number;
}

export interface HandTrackingSessionOptions {
  modelUrl?: string;
  wasmRoot?: string;
}

/**
 * One camera and HandLandmarker lifecycle for all client routes. GPU is requested
 * first, with a CPU fallback for browsers where the GPU delegate cannot initialize.
 * All three confidence thresholds are 0.5: detection, presence, and tracking.
 */
export class HandTrackingSession {
  private readonly modelUrl: string;
  private readonly wasmRoot: string;
  private video: HTMLVideoElement | null = null;
  private stream: MediaStream | null = null;
  private landmarker: HandLandmarker | null = null;
  private running = false;
  private startGeneration = 0;
  private rafId = 0;
  private lastVideoTime = -1;
  private readonly gestureMachine = new HandGestureStateMachine();
  // Stabilize the cursor, pinch tips, and palm-span reference before any gesture math.
  private readonly landmarkSmoother = new LandmarkSmoother<Landmark>([0, 4, 8, 9]);
  private status: HandInputStatus = { kind: "idle" };
  private frame: TrackedHandFrame | null = null;
  private readonly statusSubscribers = new Set<(status: HandInputStatus) => void>();
  private readonly frameSubscribers = new Set<(frame: TrackedHandFrame) => void>();
  private sawHand = false;
  private activeDeviceId: string | undefined;
  private lastStatusPublishedAt = -Infinity;

  constructor(options: HandTrackingSessionOptions = {}) {
    this.modelUrl = options.modelUrl ?? "/models/hand_landmarker.task";
    this.wasmRoot = options.wasmRoot ?? "/mediapipe/wasm";
  }

  setVideo(video: HTMLVideoElement): void {
    if (this.video === video) return;
    this.video = video;
    if (this.stream) {
      video.srcObject = this.stream;
      void video.play().catch(() => undefined);
    }
  }

  async start(deviceId?: string): Promise<void> {
    if (this.running && this.landmarker && this.activeDeviceId === deviceId) return;
    const generation = ++this.startGeneration;
    await this.stopResources(false);
    if (generation !== this.startGeneration) return;
    if (!this.video) {
      this.publishStatus({ kind: "error", reason: "camera-unavailable" });
      return;
    }
    const mediaDevices = typeof navigator !== "undefined" ? navigator.mediaDevices : undefined;
    if (!mediaDevices?.getUserMedia) {
      await this.stopResources(false);
      this.publishStatus({ kind: "error", reason: "camera-unavailable" });
      return;
    }

    this.running = true;
    this.sawHand = false;
    this.gestureMachine.reset();
    this.landmarkSmoother.reset();
    this.publishStatus({ kind: "initializing" });

    try {
      const videoConstraint: MediaTrackConstraints = deviceId
        ? { deviceId: { exact: deviceId } }
        : { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } };
      const stream = await mediaDevices.getUserMedia({ video: videoConstraint, audio: false });
      if (!this.isCurrent(generation)) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      this.stream = stream;
      this.activeDeviceId = deviceId;
      this.video.srcObject = stream;
      await this.video.play().catch(() => undefined);
      if (!this.isCurrent(generation)) return;

      const landmarker = await this.createLandmarker();
      if (!this.isCurrent(generation)) {
        await closeLandmarker(landmarker);
        return;
      }
      this.landmarker = landmarker;

      this.publishStatus({ kind: "ready" });
      this.loop();
    } catch (error) {
      if (!this.isCurrent(generation)) return;
      await this.stopResources(false);
      this.publishStatus({ kind: "error", reason: classify(error) });
    }
  }

  async stop(): Promise<void> {
    ++this.startGeneration;
    await this.stopResources(true);
  }

  subscribeStatus(callback: (status: HandInputStatus) => void): () => void {
    this.statusSubscribers.add(callback);
    callback(this.status);
    return () => this.statusSubscribers.delete(callback);
  }

  subscribeFrame(callback: (frame: TrackedHandFrame) => void): () => void {
    this.frameSubscribers.add(callback);
    if (this.frame) callback(this.frame);
    return () => this.frameSubscribers.delete(callback);
  }

  getStatus(): HandInputStatus {
    return this.status;
  }

  getFrame(): TrackedHandFrame | null {
    return this.frame;
  }

  /** Test-only injection; it intentionally uses the same publish path as camera frames. */
  feedLandmarksForTest(landmarks: Landmark[] | undefined, timestampMs = nowMs()): void {
    this.processLandmarks(landmarks, timestampMs);
  }

  private async createLandmarker(): Promise<HandLandmarker> {
    // Dynamic loading keeps server-side module evaluation free of MediaPipe/WASM.
    const { FilesetResolver, HandLandmarker } = await import("@mediapipe/tasks-vision");
    const vision = await FilesetResolver.forVisionTasks(this.wasmRoot);
    const options = {
      runningMode: "VIDEO" as const,
      numHands: 1,
      minHandDetectionConfidence: 0.5,
      minHandPresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    };
    try {
      return await HandLandmarker.createFromOptions(vision, {
        ...options,
        baseOptions: { modelAssetPath: this.modelUrl, delegate: "GPU" },
      });
    } catch {
      return HandLandmarker.createFromOptions(vision, {
        ...options,
        baseOptions: { modelAssetPath: this.modelUrl, delegate: "CPU" },
      });
    }
  }

  private loop = (): void => {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(this.loop);
    const video = this.video;
    const landmarker = this.landmarker;
    if (!video || !landmarker || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
    if (video.videoWidth <= 0 || video.videoHeight <= 0) return;
    if (video.currentTime === this.lastVideoTime) return;
    this.lastVideoTime = video.currentTime;
    const timestampMs = nowMs();
    try {
      const result: HandLandmarkerResult = landmarker.detectForVideo(video, timestampMs);
      this.processLandmarks(result.landmarks[0] as Landmark[] | undefined, timestampMs);
    } catch (error) {
      console.warn("[MediaPipe] detect error:", error);
      this.processLandmarks(undefined, timestampMs);
      this.publishStatus({ kind: "error", reason: "tracker-error" });
    }
  };

  private processLandmarks(rawLandmarks: Landmark[] | undefined, timestampMs: number): void {
    // Filter before cursor, pinch, and distance evaluation. A lost frame resets
    // history so a newly detected hand snaps in instead of dragging stale input.
    const landmarks = rawLandmarks ? this.landmarkSmoother.filter(rawLandmarks, timestampMs) : undefined;
    if (!landmarks) this.landmarkSmoother.reset();
    // MediaPipe's partial-landmark visibility is not a complete-skeleton validity
    // signal. Gesture evaluation only requires the landmark geometry it consumes.
    const gesture = this.gestureMachine.evaluate(landmarks, timestampMs);
    const frame: TrackedHandFrame = {
      landmarks,
      gesture,
      cursor: gesture.cursor,
      timestampMs,
    };
    this.frame = frame;
    this.frameSubscribers.forEach((callback) => callback(frame));

    if (gesture.state === "lost") {
      this.publishStatus(this.sawHand ? { kind: "tracking-lost" } : { kind: "no-hand" }, timestampMs);
      this.sawHand = false;
      return;
    }
    this.sawHand = true;
    if (gesture.state === "drawing") this.publishStatus({ kind: "drawing" }, timestampMs);
    else if (gesture.state === "undo-pending") this.publishStatus({ kind: "undo-pending", progress: gesture.undoProgress }, timestampMs);
    else if (gesture.state === "undo-triggered") this.publishStatus({ kind: "undo-triggered" }, timestampMs);
    else this.publishStatus({ kind: "hover", proximity: gesture.proximityRatio }, timestampMs);
  }

  private publishStatus(status: HandInputStatus, timestampMs = nowMs()): void {
    const next = normalizeStatus(status);
    if (sameStatus(this.status, next)) return;
    // Hover and dwell feedback stay responsive but do not force a provider
    // rerender for every video frame when their quantized value changes.
    if ((next.kind === "hover" || next.kind === "undo-pending")
      && this.status.kind === next.kind
      && timestampMs - this.lastStatusPublishedAt < 100) return;
    this.status = next;
    this.lastStatusPublishedAt = timestampMs;
    this.statusSubscribers.forEach((callback) => callback(next));
  }

  private isCurrent(generation: number): boolean {
    return this.running && generation === this.startGeneration;
  }

  private async stopResources(publishIdle: boolean): Promise<void> {
    this.running = false;
    cancelAnimationFrame(this.rafId);
    this.rafId = 0;
    this.lastVideoTime = -1;
    if (publishIdle) this.publishLostFrame();
    this.frame = null;
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.activeDeviceId = undefined;
    if (this.video) this.video.srcObject = null;
    await this.closeLandmarker();
    this.gestureMachine.reset();
    this.landmarkSmoother.reset();
    this.sawHand = false;
    if (publishIdle) this.publishStatus({ kind: "idle" });
  }

  private publishLostFrame(): void {
    const timestampMs = nowMs();
    const gesture = this.gestureMachine.evaluate(undefined, timestampMs);
    const frame: TrackedHandFrame = { landmarks: undefined, gesture, cursor: gesture.cursor, timestampMs };
    this.frame = frame;
    this.frameSubscribers.forEach((callback) => callback(frame));
  }

  private async closeLandmarker(): Promise<void> {
    const landmarker = this.landmarker;
    this.landmarker = null;
    await closeLandmarker(landmarker);
  }
}

async function closeLandmarker(landmarker: HandLandmarker | null): Promise<void> {
  try {
    await landmarker?.close();
  } catch {
    // MediaPipe close is best effort during route transitions.
  }
}


function nowMs(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function classify(error: unknown): HandFailureReason {
  const name = error instanceof DOMException ? error.name : "";
  const message = error instanceof Error ? error.message : String(error);
  if (name === "NotAllowedError") return "permission-denied";
  if (name === "NotFoundError" || name === "OverconstrainedError" || name === "NotReadableError") return "camera-unavailable";
  if (/model|asset|fileset|wasm/i.test(message)) return "model-error";
  return "tracker-error";
}

function normalizeStatus(status: HandInputStatus): HandInputStatus {
  if (status.kind === "hover") {
    return { ...status, proximity: quantize(status.proximity ?? 0, 0.05) };
  }
  if (status.kind === "ready" && typeof status.proximity === "number") {
    return { ...status, proximity: quantize(status.proximity, 0.05) };
  }
  if (status.kind === "undo-pending") return { ...status, progress: quantize(status.progress, 0.05) };
  return status;
}

function sameStatus(a: HandInputStatus, b: HandInputStatus): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "hover" && b.kind === "hover") return a.proximity === b.proximity;
  if (a.kind === "ready" && b.kind === "ready") return a.proximity === b.proximity;
  if (a.kind === "undo-pending" && b.kind === "undo-pending") return a.progress === b.progress;
  if (a.kind === "error" && b.kind === "error") return a.reason === b.reason;
  return true;
}

function quantize(value: number, step: number): number {
  return Math.round(value / step) * step;
}


