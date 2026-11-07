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
 * - Jump: kept false for Level 1 (cross-phase crossing not required/testable)
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

import { FilesetResolver, HandLandmarker, type HandLandmarkerResult } from "@mediapipe/tasks-vision";
import type { Landmark } from "./types";
import { getSharedStream } from "../camera/shared-stream";
import { evaluateGameplayGesture, type GameplayGestureFrame } from "./gameplay-gesture";

// Re-export frame type for consumers
export type GameplayFrame = GameplayGestureFrame;

export type GameplayStatus = "initializing" | "tracking" | "tracking-lost" | "camera-unavailable" | "error";

export interface GameplayHandDriverOptions {
  video: HTMLVideoElement;
  /** Called on every processed frame with gesture data (or neutral on loss) */
  onFrame: (frame: GameplayFrame) => void;
  /** Called on status changes */
  onStatus: (status: GameplayStatus) => void;
  /** WASM root for FilesetResolver; defaults to /mediapipe/wasm */
  wasmRoot?: string;
  /** Model asset path; defaults to /models/hand_landmarker.task */
  modelUrl?: string;
}

const STALLED_FRAME_THRESHOLD_MS = 300;
const DEFAULT_WASM_ROOT = "/mediapipe/wasm";
const DEFAULT_MODEL_URL = "/models/hand_landmarker.task";

export class GameplayHandDriver {
  private landmarker: HandLandmarker | null = null;
  private stream: MediaStream | null = null;
  private rafId = 0;
  private running = false;
  private initAborted = false;
  private lastVideoTime = -1;
  private lastProcessTime = 0;
  private generation = 0;

  constructor(private readonly options: GameplayHandDriverOptions) {}

  async start(): Promise<void> {
    const { onStatus, video, wasmRoot = DEFAULT_WASM_ROOT, modelUrl = DEFAULT_MODEL_URL } = this.options;

    // Idempotent: if already running, do nothing
    if (this.running) return;

    this.running = true;
    this.initAborted = false;
    this.lastVideoTime = -1;
    this.lastProcessTime = performance.now();
    this.generation++;
    const myGen = this.generation;

    try {
      console.log('[DRIVER-START] Entry');
      onStatus("initializing");

      // Borrow shared stream ONLY — never request new camera access
      const shared = getSharedStream();
      console.log('[DRIVER-START] shared stream:', !!shared);
      if (!shared || !shared.getVideoTracks().some((t) => t.readyState === "live")) {
        console.log('[DRIVER-START] shared stream invalid, exiting');
        this.running = false;
        onStatus("camera-unavailable");
        return;
      }
      this.stream = shared;

      // Bind video element to borrowed stream
      video.srcObject = this.stream;
      console.log('[DRIVER-START] calling video.play()');
      await video.play().catch(() => undefined);
      console.log('[DRIVER-START] video.play() resolved, initAborted:', this.initAborted);

      // Check if init was aborted while awaiting video play
      if (this.initAborted || !this.running || this.generation !== myGen) {
        console.log('[DRIVER-START] aborted during video play, exiting early');
        await this.cleanupLandmarker();
        return;
      }

      // Initialize MediaPipe HandLandmarker
      console.log('[DRIVER-START] BEFORE FilesetResolver');
      const vision = await FilesetResolver.forVisionTasks(wasmRoot);
      console.log('AFTER FilesetResolver, initAborted:', this.initAborted, 'running:', this.running);

      // Continue to create landmarker even if aborted, so it gets properly closed
      console.log('BEFORE createFromOptions');
      let created: HandLandmarker | null = null;
      try {
        created = await HandLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: modelUrl, delegate: "GPU" },
          runningMode: "VIDEO",
          numHands: 1,
        });
      } catch (e) {
        console.log('createFromOptions threw:', e);
        throw e;
      }

      console.log('AFTER createFromOptions, created:', created);
      // If aborted during createFromOptions, close the created landmarker immediately
      if (this.initAborted || !this.running || this.generation !== myGen) {
        console.log('CLEANING UP LANDMARKER BECAUSE ABORTED', {initAborted: this.initAborted, running: this.running, genMatch: this.generation === myGen, createdExists: !!created});
        if (created) {
          console.log('Calling created.close()');
          try { created.close(); console.log('created.close() done'); } catch (e) { console.log('created.close() error:', e); }
        }
        return;
      }
      this.landmarker = created;
      if (this.initAborted || !this.running || this.generation !== myGen) {
        console.log('CLEANING UP LANDMARKER BECAUSE ABORTED (post-assign)');
        await this.cleanupLandmarker();
        return;
      }

      onStatus("tracking");
      this.loop();
    } catch (err) {
      console.log('CAUGHT ERR IN START:', err);
      await this.stop();
      onStatus(this.classifyError(err));
    }
  }

  async stop(): Promise<void> {
    this.running = false;
    this.initAborted = true;
    this.generation++;
    cancelAnimationFrame(this.rafId);
    this.rafId = 0;

    // Output neutral input immediately on stop
    this.options.onFrame({
      tracked: false,
      cursor: null,
      pinched: false,
      input: { left: false, right: false, jump: false },
    });

    // Cleanup landmarker
    await this.cleanupLandmarker();

    // Do NOT cleanup video binding - leave borrowed stream intact for shared preview
    this.stream = null;
  }

  private loop = (): void => {
    if (!this.running) return;

    this.rafId = requestAnimationFrame(this.loop);

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
      this.options.onStatus("error");
      this.options.onFrame({
        tracked: false,
        cursor: null,
        pinched: false,
        input: { left: false, right: false, jump: false },
      });
      this.cleanupLandmarkerSync();
      return;
    }

    const landmarks = result.landmarks[0];
    const frame = evaluateGameplayGesture(landmarks);
    this.options.onFrame(frame);

    // Update status based on tracking state
    if (frame.tracked) {
      this.options.onStatus("tracking");
    } else {
      this.options.onStatus("tracking-lost");
    }
  };

  private checkStalledFrame(): void {
    const now = performance.now();
    if (now - this.lastProcessTime > STALLED_FRAME_THRESHOLD_MS) {
      // Stalled frame - output neutral input immediately
      this.options.onFrame({
        tracked: false,
        cursor: null,
        pinched: false,
        input: { left: false, right: false, jump: false },
      });
      this.options.onStatus("tracking-lost");
    }
  }

  private async cleanupLandmarker(): Promise<void> {
    if (this.landmarker) {
      try {
        this.landmarker.close();
      } catch {
        // best-effort
      }
      this.landmarker = null;
    }
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

  private classifyError(err: unknown): GameplayStatus {
    const name = err instanceof DOMException ? err.name : "";
    const msg = err instanceof Error ? err.message : String(err);
    if (name === "NotFoundError" || name === "OverconstrainedError" || name === "NotReadableError") {
      return "camera-unavailable";
    }
    if (/model|asset|fileset/i.test(msg)) {
      return "error";
    }
    return "error";
  }
}
