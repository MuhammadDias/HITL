import type { DrawingInput, StrokePoint } from "../domain/types";
import type { GestureStateKind } from "./hand-gesture";
import { HandTrackingSession, type TrackedHandFrame } from "./hand-tracking-session";
import { attachPointerDriver, strokesToDrawingInput } from "./pointer-input";
import { OneEuroFilter, type OneEuroFilterOptions } from "./smoothing";
import { StrokeStore, type HandInputStatus, type InputModeId, type Landmark } from "./types";

export { HandTrackingSession } from "./hand-tracking-session";
export type { TrackedHandFrame } from "./hand-tracking-session";
export type { HandInputStatus, InputModeId, Landmark } from "./types";

export interface DrawingSurfaceOptions {
  initialMode?: InputModeId;
  modelUrl?: string;
  /** Shared route-level camera/tracker session. Surface disposal never stops it. */
  session?: HandTrackingSession;
  onStatusChange?(status: HandInputStatus): void;
  onInkChange?(input: DrawingInput): void;
  /** Fine tune the 1€ filter; defaults are minCutoff 0.8, beta 0.015, dCutoff 1. */
  smoothing?: OneEuroFilterOptions;
}

export async function enumerateVideoDevices(): Promise<MediaDeviceInfo[]> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.enumerateDevices) return [];
  try { return (await navigator.mediaDevices.enumerateDevices()).filter((device) => device.kind === "videoinput"); }
  catch { return []; }
}

/** Canvas drawing controller that consumes a shared hand session and an always-on pointer driver. */
export class DrawingSurface {
  // Keep raw StrokeStore consumers deterministic, while the interactive canvas
  // opts into eased calligraphic ink for a pencil-tool feel.
  readonly store = new StrokeStore({ smoothInk: true });
  private readonly session: HandTrackingSession;
  private readonly ownsSession: boolean;
  private readonly detachPointer: () => void;
  private detachFrame: (() => void) | undefined;
  private detachStatus: (() => void) | undefined;
  private mode: InputModeId = "pointer";
  private pointerActive = false;
  private acceptingTestFrame = false;
  private handCursor: { x: number; y: number } | null = null;
  private handState: GestureStateKind = "lost";
  private handProximity = 0;
  private handUndoProgress = 0;
  private readonly smoother: OneEuroFilter;
  private handWasPinched = false;
  private pendingPinchStart: StrokePoint | null = null;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    video: HTMLVideoElement,
    private readonly options: DrawingSurfaceOptions = {},
  ) {
    this.session = options.session ?? new HandTrackingSession({ modelUrl: options.modelUrl });
    this.smoother = new OneEuroFilter({ minCutoff: 0.7, beta: 0.02, dCutoff: 1.0, ...options.smoothing });
    this.ownsSession = !options.session;
    this.session.setVideo(video);
    this.mode = options.initialMode ?? "pointer";
    this.resizeForDpr();
    this.detachPointer = attachPointerDriver(canvas, this.store, () => this.render(), {
      onStart: () => { this.pointerActive = true; this.endHandStroke(); },
      onEnd: () => { this.pointerActive = false; this.notifyInkChange(); },
    });
    this.detachFrame = this.session.subscribeFrame((frame) => this.handleSessionFrame(frame));
    this.detachStatus = this.session.subscribeStatus((status) => this.handleStatus(status));
    // A shared route-level session belongs to CameraProvider. Do not request a
    // device, restart an initializing stream, or override the selected camera.
    if (this.ownsSession && this.mode === "hand") void this.setMode("hand");
  }

  getMode(): InputModeId { return this.mode; }

  async setMode(mode: InputModeId, deviceId?: string): Promise<HandInputStatus> {
    this.mode = mode;
    if (mode === "pointer") {
      this.endHandStroke();
      this.clearHandCursor();
      if (this.ownsSession) await this.session.stop();
      this.render();
      return { kind: "idle" };
    }
    if (!this.ownsSession) return this.session.getStatus();
    try {
      await this.session.start(deviceId);
      return this.session.getStatus();
    } catch {
      const status: HandInputStatus = { kind: "error", reason: "tracker-error" };
      this.options.onStatusChange?.(status);
      return status;
    }
  }

  /** Synthetic landmarks take exactly the same HandTrackingSession -> frame processor route as camera frames. */
  feedHandLandmarksForTest(landmarks: Landmark[] | undefined, timestampMs?: number): void {
    this.acceptingTestFrame = true;
    this.session.feedLandmarksForTest(landmarks, timestampMs);
    this.acceptingTestFrame = false;
  }


  isEmpty(): boolean { return !this.store.hasInk(); }
  clear(): void { this.store.clear(); this.notifyInkChange(); this.render(); }
  undo(): boolean { const didUndo = this.store.undo(); if (didUndo) this.notifyInkChange(); this.render(); return didUndo; }
  toDrawingInput(): DrawingInput { return strokesToDrawingInput(this.store, this.cssScale()); }

  dispose(): void {
    this.endHandStroke();
    this.detachFrame?.();
    this.detachStatus?.();
    this.detachPointer();
    if (this.ownsSession) void this.session.stop();
  }

  resizeForDpr(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = this.canvas.getBoundingClientRect();
    const width = rect.width > 0 ? Math.round(rect.width * dpr) : this.canvas.width;
    const height = rect.height > 0 ? Math.round(rect.height * dpr) : this.canvas.height;
    const oldWidth = this.canvas.width;
    const oldHeight = this.canvas.height;
    if (oldWidth > 0 && oldHeight > 0 && (oldWidth !== width || oldHeight !== height)) {
      // Points are in backing-canvas coordinates while widths are CSS pixels.
      // Scale only geometry so both DPR changes and responsive layout retain ink.
      this.store.scalePoints(width / oldWidth, height / oldHeight);
    }
    this.canvas.width = width;
    this.canvas.height = height;
    this.render();
  }

  render(): void {
    const context = this.canvas.getContext("2d");
    if (!context) return;
    drawPaper(context);
    const { completed, active } = this.store.getStrokes();
    for (const stroke of active ? [...completed, active] : completed) drawStroke(context, stroke, this.cssScale());
    this.drawCursor(context);
  }

  private handleSessionFrame(frame: TrackedHandFrame): void {
    if (this.mode !== "hand" && !this.acceptingTestFrame) return;
    if (this.pointerActive) return;
    const gesture = frame.gesture;
    if (gesture.state === "lost") {
      this.endHandStroke(frame.timestampMs);
      this.clearHandCursor();
      this.smoother.reset();
      this.render();
      return;
    }

    const point = this.mapNormalizedToCanvas(this.smoother.filter(frame.cursor, frame.timestampMs));
    this.handCursor = point;
    this.handState = gesture.state;
    this.handProximity = gesture.proximityRatio;
    this.handUndoProgress = gesture.undoProgress;

    if (gesture.state === "undo-triggered") {
      this.endHandStroke(frame.timestampMs);
      this.store.undo();
      this.notifyInkChange();
    } else if (gesture.state === "undo-pending") {
      this.endHandStroke(frame.timestampMs);
    } else if (gesture.pinched) {
      this.addHandInkPoint(point, frame.timestampMs);
    } else {
      this.endHandStroke(frame.timestampMs);
    }
    this.render();
  }

  private handleStatus(status: HandInputStatus): void {
    if (status.kind === "tracking-lost" || status.kind === "no-hand" || status.kind === "idle") {
      this.endHandStroke();
      this.clearHandCursor();
      this.smoother.reset();
    }
    this.options.onStatusChange?.(status);
  }

  private addHandInkPoint(point: { x: number; y: number }, timestampMs: number): void {
    const pointWithInk = this.withVelocityInk(point, timestampMs);
    const minimum = 4 * this.cssScale();
    if (!this.handWasPinched) {
      this.handWasPinched = true;
      this.pendingPinchStart = pointWithInk;
      return;
    }
    if (this.pendingPinchStart) {
      if (distance(this.pendingPinchStart, pointWithInk) < minimum) return;
      this.store.beginStroke(timestampMs);
      this.store.addPoint(this.pendingPinchStart, minimum);
      this.store.addPoint(pointWithInk, minimum);
      this.pendingPinchStart = null;
      this.notifyInkChange();
      return;
    }
    this.store.addPoint(pointWithInk, minimum);
    this.notifyInkChange();
  }

  private withVelocityInk(point: { x: number; y: number }, timestampMs: number): StrokePoint {
    const previous = this.lastHandInk;
    const seconds = previous ? Math.max((timestampMs - previous.timestampMs) / 1000, 1 / 240) : 1 / 60;
    const velocityCss = previous ? distance(previous.point, point) / this.cssScale() / seconds : 0;
    // Slow movement is thick/opaque; fast movement tapers to a 2 CSS-pixel, lighter line.
    const t = Math.min(1, velocityCss / 1200);
    const ink: StrokePoint = { x: point.x, y: point.y, width: 12 - 10 * t, opacity: 1 - 0.55 * t };
    this.lastHandInk = { point, timestampMs };
    return ink;
  }
  private lastHandInk: { point: { x: number; y: number }; timestampMs: number } | null = null;

  private endHandStroke(timestampMs?: number): void {
    if (this.handWasPinched && !this.pendingPinchStart) {
      this.store.endStroke(timestampMs);
      this.notifyInkChange();
    }
    this.handWasPinched = false;
    this.pendingPinchStart = null;
    this.lastHandInk = null;
  }

  private clearHandCursor(): void {
    this.handCursor = null; this.handState = "lost"; this.handProximity = 0; this.handUndoProgress = 0;
  }
  private cssScale(): number {
    const rect = this.canvas.getBoundingClientRect();
    return rect.width > 0 ? this.canvas.width / rect.width : 1;
  }
  private mapNormalizedToCanvas(point: { x: number; y: number }): { x: number; y: number } {
    return { x: Math.max(0, Math.min(this.canvas.width, point.x * this.canvas.width)), y: Math.max(0, Math.min(this.canvas.height, point.y * this.canvas.height)) };
  }
  private notifyInkChange(): void { this.options.onInkChange?.(this.toDrawingInput()); }

  private drawCursor(context: CanvasRenderingContext2D): void {
    if (!this.handCursor || this.mode !== "hand") return;
    const { x, y } = this.handCursor;
    const scale = this.cssScale();

    // Sweetspot uniform circle size for both hover and drawing
    const radius = 6.5 * scale;

    context.save();
    context.shadowColor = "rgba(0, 0, 0, 0.3)";
    context.shadowBlur = 3 * scale;
    context.shadowOffsetY = 1 * scale;

    if (this.handState === "drawing") {
      // 1. PAS GAMBAR (NYUBIT): Buletan Kuning Emas Solid + Border Gelap Tegas
      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
      context.fillStyle = "#ffe169"; // Kuning terang Momo
      context.fill();

      context.shadowBlur = 0;
      context.lineWidth = 2 * scale;
      context.strokeStyle = "#0f172a"; // Border hitam tegas
      context.stroke();

      // Titik presisi tengah putih kecil
      context.beginPath();
      context.arc(x, y, 1.8 * scale, 0, Math.PI * 2);
      context.fillStyle = "#ffffff";
      context.fill();

      context.restore();
      return;
    }

    if (this.handState.startsWith("undo")) {
      // 2. PAS UNDO (V-SIGN): Buletan Merah + Border Gelap
      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
      context.fillStyle = "#ef4444";
      context.fill();

      context.shadowBlur = 0;
      context.lineWidth = 2 * scale;
      context.strokeStyle = "#0f172a";
      context.stroke();

      if (this.handUndoProgress > 0) {
        context.lineWidth = 2.5 * scale;
        context.strokeStyle = "#ef4444";
        context.beginPath();
        context.arc(x, y, radius + 4 * scale, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * this.handUndoProgress);
        context.stroke();
      }

      context.restore();
      return;
    }

    // 3. PAS BELUM GAMBAR / MELAYANG (HOVER):
    // Buletan dengan ukuran sweetspot yang sama.
    // Warna Biru Cyan cerah (#38bdf8), transisi ke Amber (#f59e0b) pas jari makin rapat mau nyubit
    const proximity = Math.max(0, Math.min(1, this.handProximity));
    const hoverColor = proximity > 0.65 ? "#f59e0b" : "#38bdf8";

    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fillStyle = hoverColor;
    context.fill();

    context.shadowBlur = 0;
    context.lineWidth = 2 * scale;
    context.strokeStyle = "#0f172a"; // Border hitam tegas
    context.stroke();

    // Titik presisi tengah putih
    context.beginPath();
    context.arc(x, y, 1.8 * scale, 0, Math.PI * 2);
    context.fillStyle = "#ffffff";
    context.fill();

    context.restore();
  }
}

export interface NormalizedRenderOptions { width?: number; height?: number; padding?: number; background?: string | null; ink?: string; }
/** Draw a clean, centered, aspect-preserving normalized illustration; no paper grid or cursor is ever added. */
export function renderNormalizedDrawing(context: CanvasRenderingContext2D, input: DrawingInput, options: NormalizedRenderOptions = {}): void {
  const width = options.width ?? context.canvas.width;
  const height = options.height ?? context.canvas.height;
  const padding = options.padding ?? Math.round(Math.min(width, height) * 0.08);
  context.clearRect(0, 0, width, height);
  if (options.background !== null) { context.fillStyle = options.background ?? "#ffffff"; context.fillRect(0, 0, width, height); }
  const side = Math.max(1, Math.min(width, height) - padding * 2);
  const xOffset = (width - side) / 2;
  const yOffset = (height - side) / 2;
  for (const stroke of input.strokes) {
    drawStroke(context, stroke.map((point) => ({ ...point, x: xOffset + point.x * side, y: yOffset + point.y * side, width: typeof point.width === "number" ? point.width * side : undefined })), 1, options.ink ?? "#23324d");
  }
}

export function renderDrawingInput(input: DrawingInput, canvas: HTMLCanvasElement, options: NormalizedRenderOptions = {}): void {
  const context = canvas.getContext("2d"); if (context) renderNormalizedDrawing(context, input, options);
}

export function exportDrawingCanvas(input: DrawingInput, options: { size?: number; transparent?: boolean; padding?: number } = {}): HTMLCanvasElement {
  const size = options.size ?? 256;
  const canvas = document.createElement("canvas"); canvas.width = size; canvas.height = size;
  renderDrawingInput(input, canvas, { padding: options.padding, background: options.transparent ? null : "#ffffff" });
  return canvas;
}

export function drawingInputToModelRaster(input: DrawingInput, size = 224): { width: number; height: number; data: Uint8ClampedArray; polarity: "dark-ink-on-light" } {
  const canvas = exportDrawingCanvas(input, { size });
  const context = canvas.getContext("2d");
  return { width: size, height: size, data: context?.getImageData(0, 0, size, size).data ?? new Uint8ClampedArray(size * size * 4), polarity: "dark-ink-on-light" };
}

function drawPaper(context: CanvasRenderingContext2D): void {
  const { width, height } = context.canvas;
  context.clearRect(0, 0, width, height); context.fillStyle = "#fdfaf3"; context.fillRect(0, 0, width, height);
  context.strokeStyle = "#dfe8f2"; context.lineWidth = 1;
  for (let y = 24; y < height; y += 24) { context.beginPath(); context.moveTo(0, y); context.quadraticCurveTo(width / 2, y, width, y); context.stroke(); }
}

/**
 * Draw with midpoint quadratic segments. Consecutive segments meet at a shared
 * midpoint, so their tangents follow the same control-point direction instead
 * of producing the hard corners caused by start-point control handles.
 */
export function drawStroke(context: CanvasRenderingContext2D, stroke: StrokePoint[], cssScale: number, ink = "#23324d"): void {
  if (stroke.length < 2) return;
  context.strokeStyle = ink; context.lineCap = "round"; context.lineJoin = "round";
  let start = stroke[0]!;
  for (let index = 1; index < stroke.length; index++) {
    const control = stroke[index]!;
    const next = stroke[index + 1];
    const end = next
      ? { x: (control.x + next.x) / 2, y: (control.y + next.y) / 2 }
      : control;
    context.globalAlpha = control.opacity ?? 1;
    context.lineWidth = Math.max(2 * cssScale, (control.width ?? 4) * cssScale);
    context.beginPath(); context.moveTo(start.x, start.y);
    context.quadraticCurveTo(control.x, control.y, end.x, end.y);
    context.stroke();
    start = end;
  }
  context.globalAlpha = 1;
}
function distance(a: { x: number; y: number }, b: { x: number; y: number }): number { return Math.hypot(a.x - b.x, a.y - b.y); }
