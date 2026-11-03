import type { StrokePoint } from "../domain/types";

/** Raw stroke as captured in canvas pixel space. */
export type RawStroke = StrokePoint[];

/** Identifies the active drawing modality. */
export type InputModeId = "pointer" | "hand";

/** Camera/tracker lifecycle states surfaced to the UI (TASK 05/13). */
export type HandInputStatus =
  | { kind: "idle" }
  | { kind: "initializing" }
  | { kind: "ready" }
  | { kind: "drawing" }
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
}

/**
 * Unified stroke sink shared by every input modality (TASK 06):
 * pointer/touch drivers and the MediaPipe hand driver all push
 * points into this one representation before normalization.
 */
export class StrokeStore {
  private strokes: RawStroke[] = [];
  private undone: RawStroke[] = [];
  private active: RawStroke | null = null;

  beginStroke(): void {
    if (!this.active) this.active = [];
    this.undone = [];
  }

  addPoint(p: StrokePoint): void {
    if (!this.active) this.active = [];
    const last = this.active[this.active.length - 1];
    // Skip zero-distance jitter duplicates.
    if (last && Math.abs(last.x - p.x) < 0.5 && Math.abs(last.y - p.y) < 0.5) return;
    this.active.push(p);
  }

  endStroke(): void {
    if (this.active && this.active.length > 0) {
      this.strokes.push(this.active);
      this.undone = [];
    }
    this.active = null;
  }

  getStrokes(): { completed: RawStroke[]; active: RawStroke | null } {
    return { completed: [...this.strokes], active: this.active };
  }

  /** True only when at least one finished/meaningful stroke exists. */
  hasInk(): boolean {
    return this.strokes.length > 0 || (this.active !== null && this.active.length >= 2);
  }

  /** Optional simple undo (TASK 06): removes the last completed stroke. */
  undo(): boolean {
    const popped = this.strokes.pop();
    if (popped) {
      this.undone.push(popped);
      return true;
    }
    return false;
  }

  /** Re-applies the last undone stroke. */
  redo(): boolean {
    const restored = this.undone.pop();
    if (restored) {
      this.strokes.push(restored);
      return true;
    }
    return false;
  }

  clear(): void {
    if (this.strokes.length > 0) {
      this.undone.push(...this.strokes);
    }
    this.strokes = [];
    this.active = null;
  }
}
