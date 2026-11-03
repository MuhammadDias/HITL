import type { LevelContext, ObjectBehavior } from "../domain/types.js";

/**
 * FR-10/11/12: Placeholder consequence scene runtime.
 *
 * DEV/PLACEHOLDER notes:
 * - Character movement is a scripted auto-walk. The exact character-control
 *   scheme remains an UNRESOLVED product item (PRD §17) — this runtime only
 *   demonstrates that the resolved human decision produces an observable
 *   consequence with success/fail/recovery paths.
 * - Scene geometry comes from level config (replaceable, not final level data).
 */

export type GameplayState = "running" | "success" | "failed";
export type GameplayOutcome = "success" | "fail";

const CHAR_SIZE = 28;
const WALK_SPEED = 120; // px/s (placeholder)
const GRAVITY = 900; // px/s^2

export interface GameplaySnapshot {
  state: GameplayState;
  charX: number;
  charY: number;
  behavior: ObjectBehavior;
}

export class GameplayRuntime {
  private readonly groundY: number;
  private readonly worldEndX: number;
  /** Walkable segments [start,end] including bridge when present. */
  readonly segments: Array<{ start: number; end: number }>;
  readonly hasBridge: boolean;

  private x = 40;
  private y: number;
  private vy = 0;
  private _state: GameplayState = "running";

  constructor(
    private readonly level: LevelContext,
    public readonly behavior: ObjectBehavior,
    private readonly canvasW = 800,
    canvasH = 380,
  ) {
    this.groundY = canvasH - 60;
    this.y = this.groundY - CHAR_SIZE;
    const { gapStartX, gapWidth, goalX } = level.scene;
    // Solid and controlled-fallback both provide a crossable platform;
    // unresolved renders as a neutral dashed placeholder (FR-09).
    this.hasBridge = behavior !== "danger";
    const segs: Array<{ start: number; end: number }> = [
      { start: 0, end: gapStartX },
      { start: gapStartX + gapWidth, end: Math.max(goalX + 80, gapStartX + gapWidth + 200) },
    ];
    if (this.hasBridge) {
      segs.splice(1, 0, { start: gapStartX, end: gapStartX + gapWidth });
    }
    this.segments = segs;
    this.worldEndX = Math.max(goalX + 80, gapStartX + gapWidth + 200);
  }

  get state(): GameplayState {
    return this._state;
  }

  get snapshot(): GameplaySnapshot {
    return { state: this._state, charX: this.x, charY: this.y, behavior: this.behavior };
  }

  /** Pure-ish simulation step; tests drive it directly without rAF. */
  update(dtSeconds: number): void {
    if (this._state !== "running") return;
    const dt = Math.min(Math.max(dtSeconds, 0), 0.1);

    const prevX = this.x;
    this.x = Math.min(this.x + WALK_SPEED * dt, this.worldEndX);

    const overSupport = this.supportedAt(this.x);
    if (!overSupport && !this.supportedAt(prevX)) {
      // Already airborne: keep falling.
      this.vy += GRAVITY * dt;
      this.y += this.vy * dt;
    } else if (!overSupport && this.supportedAt(prevX)) {
      // Just walked off an edge into the gap.
      this.vy = GRAVITY * dt;
      this.y += this.vy * dt;
    } else {
      this.y = this.groundY - CHAR_SIZE;
      this.vy = 0;
    }

    const fellOffScreen = this.y > this.groundY + CHAR_SIZE * 2.5;
    if (fellOffScreen) {
      this._state = "failed"; // Danger/no-bridge consequence (FR-11)
      return;
    }
    if (overSupport && this.x >= this.level.scene.goalX) {
      this._state = "success"; // Reached goal across configured span (FR-10)
    }
  }

  private supportedAt(x: number): boolean {
    for (const s of this.segments) {
      if (x >= s.start - 1 && x <= s.end + 1) return true;
    }
    return false;
  }

  outcome(): GameplayOutcome | null {
    if (this._state === "success") return "success";
    if (this._state === "failed") return "fail";
    return null;
  }
}
