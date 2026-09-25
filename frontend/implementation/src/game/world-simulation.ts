import type { DrawingInput, LevelContext, ObjectBehavior } from "../domain/types";

export const WORLD_WIDTH = 960;
export const WORLD_HEIGHT = 450;
export const GROUND_Y = 350;
export interface Platform { x: number; y: number; w: number; h: number; kind: "ground" | "step" | "drawing" }
export interface WorldControls { axis: number; jump: boolean }
export interface WorldCreation { drawing: DrawingInput; label: string; behavior: ObjectBehavior }
export type WorldOutcome = "success" | "fail" | null;

/** Deterministic browser-side physics. KAPLAY owns update/draw; no timer outcomes. */
export class WorldSimulation {
  x = 65;
  y = GROUND_Y;
  vy = 0;
  grounded = true;
  elapsed = 0;
  facing = 1;
  walking = false;
  outcome: WorldOutcome = null;
  readonly platforms: Platform[];
  readonly goalY: number;
  constructor(readonly level: LevelContext, readonly creation: WorldCreation | null) {
    const s = level.scene;
    this.goalY = level.stage === 2 ? GROUND_Y - 66 : GROUND_Y;
    this.platforms = [
      { x: 0, y: GROUND_Y, w: s.gapStartX, h: 100, kind: "ground" },
      { x: s.gapStartX + s.gapWidth, y: GROUND_Y, w: WORLD_WIDTH - s.gapStartX - s.gapWidth, h: 100, kind: "ground" },
    ];
    if (creation?.behavior === "solid") this.platforms.push({ x: s.gapStartX - 8, y: GROUND_Y, w: s.gapWidth + 16, h: 12, kind: "drawing" });
    if (level.stage === 2) {
      this.platforms.push({ x: 655, y: GROUND_Y - 33, w: 90, h: 33, kind: "step" });
      this.platforms.push({ x: 745, y: GROUND_Y - 66, w: 215, h: 66, kind: "step" });
    }
  }
  get eraserX() { return 705 + Math.sin(this.elapsed * 1.5) * 65; }
  step(delta: number, controls: WorldControls) {
    if (this.outcome) return;
    let remaining = Math.min(Math.max(delta, 0), 0.05);
    if (controls.jump && this.grounded) { this.vy = -430; this.grounded = false; }
    while (remaining > 0.000001) {
      const dt = Math.min(remaining, 1 / 120);
      this.tick(dt, Math.max(-1, Math.min(1, controls.axis)));
      remaining -= dt;
      if (this.outcome) break;
    }
  }
  private tick(dt: number, axis: number) {
    this.elapsed += dt;
    this.walking = Math.abs(axis) > 0.05;
    if (this.walking) this.facing = axis > 0 ? 1 : -1;
    const oldX = this.x;
    let nx = Math.max(14, Math.min(WORLD_WIDTH - 14, this.x + axis * 210 * dt));
    if (!this.creation) nx = Math.min(nx, this.level.scene.gapStartX - 15);
    for (const p of this.platforms) {
      if (this.y <= p.y + 0.1 || this.y - 58 >= p.y + p.h) continue;
      if (axis > 0 && oldX + 12 <= p.x + 0.1 && nx + 12 > p.x) nx = p.x - 12;
      if (axis < 0 && oldX - 12 >= p.x + p.w - 0.1 && nx - 12 < p.x + p.w) nx = p.x + p.w + 12;
    }
    this.x = nx;
    const oldY = this.y;
    this.vy += 1200 * dt;
    this.y += this.vy * dt;
    this.grounded = false;
    for (const p of this.platforms) {
      if (this.x + 10 > p.x && this.x - 10 < p.x + p.w && this.vy >= 0 && oldY <= p.y + 0.1 && this.y >= p.y) {
        this.y = p.y; this.vy = 0; this.grounded = true;
      }
    }
    if (!this.creation) return;
    const { gapStartX, gapWidth, goalX } = this.level.scene;
    if (this.creation.behavior === "danger" && this.x + 10 > gapStartX && this.x - 10 < gapStartX + gapWidth && this.y > GROUND_Y - 22) this.outcome = "fail";
    if (this.creation.behavior === "unresolved" && this.x > gapStartX + 10 && this.x < gapStartX + gapWidth && this.y > GROUND_Y + 45) this.outcome = "fail";
    if (this.level.stage === 3 && Math.abs(this.x - this.eraserX) < 25 && this.y > GROUND_Y - 36 && this.y - 58 < GROUND_Y) this.outcome = "fail";
    if (this.y > WORLD_HEIGHT + 50) this.outcome = "fail";
    if (this.x >= goalX && this.grounded && Math.abs(this.y - this.goalY) < 2) this.outcome = "success";
  }
}

/** Mirrored index-tip position acts as a joystick; centre is a neutral zone. */
export function gestureAxis(x: number, tracked: boolean): number {
  if (!tracked || !Number.isFinite(x)) return 0;
  if (x < 0.4) return -Math.min(1, (0.4 - x) / 0.2);
  if (x > 0.6) return Math.min(1, (x - 0.6) / 0.2);
  return 0;
}
