import type { Landmark, StrokeStore, HandInputStatus } from "./types";
import type { GestureEvaluationResult } from "./hand-gesture";
import { HandTrackingSession, type TrackedHandFrame } from "./hand-tracking-session";

/**
 * Compatibility adapter retained for direct consumers of the prior driver API.
 * New UI code should pass the shared HandTrackingSession to DrawingSurface.
 * The adapter does not own a second MediaPipe implementation: it consumes the
 * same session frames and immediately closes a stroke on loss.
 */
export interface HandDriverOptions {
  canvas: HTMLCanvasElement;
  video: HTMLVideoElement;
  store: StrokeStore;
  modelUrl: string;
  deviceId?: string;
  wasmRoot?: string;
  session?: HandTrackingSession;
  onStatus(status: HandInputStatus): void;
  onRender(): void;
  onFrame?(result: GestureEvaluationResult, canvasPt: { x: number; y: number }): void;
}

export class HandDrawingDriver {
  private readonly session: HandTrackingSession;
  private readonly ownsSession: boolean;
  private detachFrame: (() => void) | undefined;
  private detachStatus: (() => void) | undefined;
  private wasPinched = false;

  constructor(private readonly options: HandDriverOptions) {
    this.session = options.session ?? new HandTrackingSession({ modelUrl: options.modelUrl, wasmRoot: options.wasmRoot });
    this.ownsSession = !options.session;
    this.session.setVideo(options.video);
  }

  async start(): Promise<void> {
    this.detachStatus = this.session.subscribeStatus(this.options.onStatus);
    this.detachFrame = this.session.subscribeFrame((frame) => this.process(frame));
    await this.session.start(this.options.deviceId);
  }

  feedLandmarksForTest(landmarks: Landmark[] | undefined, timestampMs: number): void {
    this.session.feedLandmarksForTest(landmarks, timestampMs);
  }

  async stop(): Promise<void> {
    this.detachFrame?.(); this.detachFrame = undefined;
    this.detachStatus?.(); this.detachStatus = undefined;
    this.options.store.endStroke();
    this.wasPinched = false;
    if (this.ownsSession) await this.session.stop();
  }

  private process(frame: TrackedHandFrame): void {
    const point = { x: frame.cursor.x * this.options.canvas.width, y: frame.cursor.y * this.options.canvas.height };
    this.options.onFrame?.(frame.gesture, point);
    if (frame.gesture.state === "lost") {
      if (this.wasPinched) this.options.store.endStroke(frame.timestampMs);
      this.wasPinched = false;
    } else if (frame.gesture.pinched) {
      if (!this.wasPinched) this.options.store.beginStroke(frame.timestampMs);
      const rect = this.options.canvas.getBoundingClientRect();
      const backingPixelsPerCss = rect.width > 0 ? this.options.canvas.width / rect.width : 1;
      this.options.store.addPoint(point, 3 * backingPixelsPerCss);
      this.wasPinched = true;
    } else if (this.wasPinched) {
      this.options.store.endStroke(frame.timestampMs);
      this.wasPinched = false;
    }
    this.options.onRender();
  }
}
