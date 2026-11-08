/**
 * Read-only physics state passed to character animation adapter.
 * Adapter NEVER mutates player pos/vel or controller state.
 */

export type GameTerminalPhase = "playing" | "win" | "fail";

export interface ReadonlyPlayerPhysicsState {
  readonly x: number;
  readonly y: number;
  readonly vx: number;
  readonly vy: number;
  readonly grounded: boolean;
  readonly facing: 1 | -1;
  readonly terminalPhase?: GameTerminalPhase;
  /**
   * Optional displacement-derived horizontal velocity or intent.
   * Addresses engine case where player.move does not populate body vel.x.
   */
  readonly resolvedVx?: number;
}

export type CharacterVariant = "A" | "B";

export interface CharacterAdapterOptions {
  readonly variant?: CharacterVariant;
  readonly reducedMotion?: boolean;
}

export interface CharacterVisualTransform {
  readonly spriteName: string;
  readonly svgDataUri: string;
  readonly offsetX: number;
  readonly offsetY: number;
  readonly scaleX: number;
  readonly scaleY: number;
}
