import type { StrokePoint } from "../domain/types";

/** Raw stroke as captured in canvas pixel space. */
export type RawStroke = StrokePoint[];

/** Identifies the active drawing modality. */
export type InputModeId = "pointer" | "hand";

/** Camera/tracker lifecycle states surfaced to the UI (TASK 05/13/UX upgrade). */
export type HandInputStatus =
  | { kind: "idle" }
  | { kind: "initializing" }
  | { kind: "ready"; proximity?: number }
  | { kind: "hover"; proximity?: number }
  | { kind: "drawing" }
  | { kind: "undo-pending"; progress: number }
  | { kind: "undo-triggered" }
  | { kind: "no-hand" }
  | { kind: "tracking-lost" }
  | { kind: "error"; reason: HandFailureReason };

export type HandFailureReason =
  | "permission-denied"
  | "camera-unavailable"
  | "model-error"
  | "tracker-error";

export interface Landmark {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}

export interface StrokeStoreOptions {
  /** Minimum stroke duration in ms before saving (debounce). Default: 80 ms */
  minStrokeDurationMs?: number;
  /** Minimum stroke path length in px before saving (debounce). Default: 6 px */
  minStrokeLengthPx?: number;
  /**
   * Baseline distance between stored samples in backing-canvas pixels. The
   * default filters sub-4px tremor; input drivers may raise it for DPR.
   */
  minPointDistancePx?: number;
  /** Apply an exponential moving average to calligraphic width and opacity. Default: false. */
  smoothInk?: boolean;
  /** Weight of each new ink sample when smoothInk is enabled. Default: 0.32. */
  inkSmoothingAlpha?: number;
}

/**
 * Unified stroke sink shared by every input modality (TASK 06):
 * pointer/touch drivers and the MediaPipe hand driver all push
 * points into this one representation before normalization.
 *
 * Implements micro-tap debounce: discards strokes with duration < 80ms
 * and path length < 6px.
 */
export class StrokeStore {
  private strokes: RawStroke[] = [];
  private active: RawStroke | null = null;
  private activeStartTime: number | null = null;
  private minStrokeDurationMs: number;
  private minStrokeLengthPx: number;
  private minPointDistancePx: number;
  private smoothInk: boolean;
  private inkSmoothingAlpha: number;

  constructor(options: StrokeStoreOptions = {}) {
    this.minStrokeDurationMs = options.minStrokeDurationMs ?? 80;
    this.minStrokeLengthPx = options.minStrokeLengthPx ?? 6;
    this.minPointDistancePx = options.minPointDistancePx ?? 3.75;
    this.smoothInk = options.smoothInk ?? false;
    this.inkSmoothingAlpha = clamp(options.inkSmoothingAlpha ?? 0.32, 0.01, 1);
  }

  beginStroke(timestampMs?: number): void {
    if (!this.active) {
      this.active = [];
      this.activeStartTime = timestampMs ?? (typeof performance !== "undefined" ? performance.now() : Date.now());
    }
  }

  addPoint(p: StrokePoint, minDistancePx = this.minPointDistancePx): void {
    if (!this.active) {
      this.active = [];
      this.activeStartTime = typeof performance !== "undefined" ? performance.now() : Date.now();
    }

    const last = this.active[this.active.length - 1];
    const point = this.smoothInkPoint(p, last);
    // Keep the 3.75px tremor floor even when an older input driver supplies a
    // smaller threshold. A close sample is retained at a corner so decimation
    // does not round away deliberate turns or an end-of-gesture pause.
    const minimum = Math.max(this.minPointDistancePx, minDistancePx);
    if (last && Math.hypot(last.x - point.x, last.y - point.y) < minimum) {
      const previous = this.active[this.active.length - 2];
      if (!previous || !formsSharpCorner(previous, last, point)) return;
    }
    this.active.push(point);
  }

  private smoothInkPoint(point: StrokePoint, previous?: StrokePoint): StrokePoint {
    if (!this.smoothInk || !previous) return point;
    const alpha = this.inkSmoothingAlpha;
    return {
      ...point,
      ...(typeof point.width === "number" && typeof previous.width === "number"
        ? { width: previous.width + (point.width - previous.width) * alpha }
        : {}),
      ...(typeof point.opacity === "number" && typeof previous.opacity === "number"
        ? { opacity: previous.opacity + (point.opacity - previous.opacity) * alpha }
        : {}),
    };
  }

  endStroke(timestampMs?: number): void {
    if (this.active && this.active.length > 0) {
      const now = timestampMs ?? (typeof performance !== "undefined" ? performance.now() : Date.now());
      const duration = this.activeStartTime !== null ? now - this.activeStartTime : 0;

      let totalLength = 0;
      for (let i = 1; i < this.active.length; i++) {
        const curr = this.active[i];
        const prev = this.active[i - 1];
        if (curr && prev) {
          totalLength += Math.hypot(curr.x - prev.x, curr.y - prev.y);
        }
      }

      // A held still pointer/finger must not become a visible ink blot. A moving
      // stroke still uses the short-tap debounce below.
      const hasMovement = totalLength >= this.minPointDistancePx;
      const isMicroTap = duration < this.minStrokeDurationMs && totalLength < this.minStrokeLengthPx;
      if (hasMovement && !isMicroTap) this.strokes.push(this.active);
    }
    this.active = null;
    this.activeStartTime = null;
  }

  cancelActiveStroke(): void {
    this.active = null;
    this.activeStartTime = null;
  }

  getStrokes(): { completed: RawStroke[]; active: RawStroke | null } {
    return { completed: [...this.strokes], active: this.active };
  }

  /** True only when at least one finished/meaningful stroke exists. */
  hasInk(): boolean {
    return this.strokes.length > 0 || (this.active !== null && this.active.length >= 2);
  }

  /** Undo: removes the last completed stroke. */
  undo(): boolean {
    return this.strokes.pop() !== undefined;
  }

  /** Rescale backing-canvas geometry after a canvas resize. Width stays in CSS pixels. */
  scalePoints(scaleX: number, scaleY: number): void {
    if (!Number.isFinite(scaleX) || !Number.isFinite(scaleY) || (scaleX === 1 && scaleY === 1)) return;
    for (const stroke of [...this.strokes, ...(this.active ? [this.active] : [])]) {
      for (const point of stroke) {
        point.x *= scaleX;
        point.y *= scaleY;
      }
    }
  }

  clear(): void {
    this.strokes = [];
    this.active = null;
    this.activeStartTime = null;
  }
}

/** Treat a direction change of 45° or more as intentional geometry. */
function formsSharpCorner(previous: StrokePoint, pivot: StrokePoint, candidate: StrokePoint): boolean {
  const incomingX = pivot.x - previous.x;
  const incomingY = pivot.y - previous.y;
  const outgoingX = candidate.x - pivot.x;
  const outgoingY = candidate.y - pivot.y;
  const incomingLength = Math.hypot(incomingX, incomingY);
  const outgoingLength = Math.hypot(outgoingX, outgoingY);
  if (incomingLength === 0 || outgoingLength === 0) return false;
  const cosine = (incomingX * outgoingX + incomingY * outgoingY) / (incomingLength * outgoingLength);
  return cosine <= Math.SQRT1_2;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}
