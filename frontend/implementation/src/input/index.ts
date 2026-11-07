import type { DrawingInput } from "../domain/types";
import { StrokeStore, type HandInputStatus, type InputModeId } from "./types";
import { attachPointerDriver, strokesToDrawingInput } from "./pointer-input";
import { HandDrawingDriver } from "./mediapipe-input";
import { evaluateGesture, mapToCanvas, type CursorState } from "./hand-gesture";
import { PointSmoother } from "./smoothing";

/**
 * TASK 06 — Drawing workspace orchestrator.
 * One stroke store, swappable input drivers (pointer default, MediaPipe hand),
 * high-DPI aware canvas rendering, clear/undo/submit-validation support.
 */
export interface DrawingSurfaceOptions {
  initialMode?: InputModeId;
  modelUrl?: string;
  onStatusChange?(status: HandInputStatus): void;
  onInkChange?(hasInk: boolean): void;
}

export class DrawingSurface {
  readonly store = new StrokeStore();
  private detachPointer: (() => void) | null = null;
  private handDriver: HandDrawingDriver | null = null;
  private cursor: { x: number; y: number; state: "hover" | "near" | "drawing" } | null = null;
  private readonly smoother = new PointSmoother();
  private lastReportedInk = false;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly video: HTMLVideoElement | null,
    private options: DrawingSurfaceOptions = {},
  ) {
    this.resizeForDpr();
    this.attachPointer();
    void this.setMode(options.initialMode ?? "pointer");
  }

  /* ---------------- mode management ---------------- */

  getMode(): InputModeId {
    return this.handDriver ? "hand" : "pointer";
  }

  /** Switch input modality. Hand failures leave pointer active (TASK 13). */
  async setMode(mode: InputModeId): Promise<HandInputStatus> {
    if (mode === "pointer") {
      await this.stopHand();
      return { kind: "idle" };
    }
    if (!this.handDriver) {
      if (!this.video) return { kind: "error", reason: "camera-unavailable" };
      try {
        this.detachPointer?.();
        this.handDriver = new HandDrawingDriver({
          canvas: this.canvas,
          video: this.video,
          store: this.store,
          modelUrl: this.options.modelUrl ?? "/models/hand_landmarker.task",
          onStatus: (s) => {
            this.updateHandCursorFromStatus(s);
            this.options.onStatusChange?.(s);
          },
          onRender: () => {
            this.render();
            this.reportInkChange();
          },
          onCursor: (c) => {
            this.cursor = c;
            this.render();
          },
        });
        await this.handDriver.start();
      } catch {
        // Any construction failure falls back to pointer without restart.
        await this.stopHand();
        this.attachPointer();
        const status: HandInputStatus = { kind: "error", reason: "tracker-error" };
        this.options.onStatusChange?.(status);
        return status;
      }
    }
    return { kind: "initializing" };
  }

  private updateHandCursorFromStatus(status: HandInputStatus): void {
    if (status.kind === "tracking-lost") {
      this.cursor = null;
      this.smoother.reset();
    }
  }

  private attachPointer(): void {
    if (this.detachPointer) return;
    this.detachPointer = attachPointerDriver(
      this.canvas,
      this.store,
      () => {
        this.render();
        this.reportInkChange();
      },
      (c) => {
        this.cursor = c;
        this.render();
      },
    );
  }

  private async stopHand(): Promise<void> {
    if (this.handDriver) {
      const d = this.handDriver;
      this.handDriver = null;
      await d.stop();
      this.options.onStatusChange?.({ kind: "idle" });
    }
    this.cursor = null;
    this.attachPointer();
  }

  /**
   * TEST HOOK (TASK 14): inject synthetic landmarks into the gesture pipeline.
   * Works with or without an active camera/driver so automation can exercise
   * mapping/smoothing/stroke production headlessly.
   */
  feedHandLandmarksForTest(
    landmarks: Array<{ x: number; y: number; z?: number }> | undefined,
    _ts = 0,
  ): void {
    const frame = evaluateGesture(landmarks);
    if (frame.state === "lost") {
      if (this.store.hasInk()) this.store.endStroke();
      this.cursor = null;
      this.smoother.reset();
      this.render();
      return;
    }
    const smoothed = this.smoother.smooth(frame.cursor, _ts);
    const canvasPt = mapToCanvas(smoothed, this.canvas.width, this.canvas.height);
    this.cursor = { x: canvasPt.x, y: canvasPt.y, state: frame.cursorState };
    if (frame.pinched && !this.lastTestPinch) this.store.beginStroke();
    if (frame.pinched) this.store.addPoint(canvasPt);
    else if (this.lastTestPinch) this.store.endStroke();
    this.lastTestPinch = frame.pinched;
    this.render();
  }

  private lastTestPinch = false;

  /** Expose smoothed cursor for overlay rendering from gesture pipeline tests. */
  pushTestCursor(p: { x: number; y: number }): void {
    const s = this.smoother.smooth(p);
    const canvasPt = mapToCanvas(s, this.canvas.width, this.canvas.height);
    this.cursor = { x: canvasPt.x, y: canvasPt.y, state: "hover" };
    this.render();
  }

  /* ---------------- workspace ops ---------------- */

  private reportInkChange(): void {
    const hasInk = this.store.hasInk();
    if (hasInk === this.lastReportedInk) return;
    this.lastReportedInk = hasInk;
    this.options.onInkChange?.(hasInk);
  }

  isEmpty(): boolean {
    return !this.store.hasInk();
  }

  clear(): void {
    this.store.clear();
    this.render();
    this.reportInkChange();
  }

  /** Simple undo of last completed stroke (TASK 06 optional feature). */
  undo(): boolean {
    const ok = this.store.undo();
    this.render();
    this.reportInkChange();
    return ok;
  }

  /** Re-applies the last undone stroke. */
  redo(): boolean {
    const ok = this.store.redo();
    this.render();
    this.reportInkChange();
    return ok;
  }

  toDrawingInput(): DrawingInput {
    return strokesToDrawingInput(this.store);
  }

  dispose(): void {
    void this.stopHand();
    this.detachPointer?.();
    this.detachPointer = null;
  }

  /* ---------------- rendering ---------------- */

  /** High-DPI sizing; resilient to container resizes (TASK 06). */
  resizeForDpr(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = this.canvas.getBoundingClientRect();
    const w = rect.width > 0 ? Math.round(rect.width * dpr) : this.canvas.width;
    const h = rect.height > 0 ? Math.round((rect.height / (rect.width || 1)) * w) : this.canvas.height;
    this.canvas.width = w;
    this.canvas.height = h;
    this.render();
  }

  render(): void {
    const ctx = this.canvas.getContext("2d");
    if (!ctx) return;
    drawPaper(ctx);

    const { completed, active } = this.store.getStrokes();
    this.canvas.dataset.strokeCount = String(completed.length + (active ? 1 : 0));
    this.canvas.dataset.pointCount = String(completed.reduce((n, stroke) => n + stroke.length, 0) + (active?.length ?? 0));
    ctx.strokeStyle = "#23211d";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = Math.max(3, Math.round(this.canvas.width / 160));
    for (const stroke of active ? [...completed, active] : completed) {
      if (stroke.length === 0) continue;
      ctx.beginPath();
      ctx.moveTo(stroke[0]!.x, stroke[0]!.y);
      for (const p of stroke.slice(1)) ctx.lineTo(p.x, p.y);
      if (stroke.length === 1) ctx.lineTo(stroke[0]!.x + 0.6, stroke[0]!.y);
      ctx.stroke();
    }

    if (this.cursor) {
      const { x, y, state } = this.cursor;
      const cssW = this.canvas.clientWidth || (this.canvas.width / (window.devicePixelRatio || 1)) || this.canvas.width;
      const scale = this.canvas.width / (cssW || 1);
      const r = 6.5 * scale;
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = state === "drawing" ? "#ffe169" : state === "near" ? "#f59e0b" : "#38bdf8";
      ctx.fill();
      ctx.lineWidth = Math.max(2, Math.round(2 * scale));
      ctx.strokeStyle = "#111111";
      ctx.stroke();
      ctx.restore();
    }
  }
}

/** Transparent canvas clearing — allows full-bleed CSS sketchbook dot-grid to show through. */
function drawPaper(ctx: CanvasRenderingContext2D): void {
  const c = ctx.canvas;
  ctx.clearRect(0, 0, c.width, c.height);
}
