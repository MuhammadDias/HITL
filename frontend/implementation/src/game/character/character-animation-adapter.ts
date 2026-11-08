/**
 * CharacterAnimationAdapter
 * Consumes readonly physics state from KAPLAY player controller.
 * Generates presentation poses according to pure mathematics from stickman-ab.html.
 * Never mutates incoming physics state, position, or velocity.
 */

import {
  CHARACTER_A_CONFIG,
  CHARACTER_B_CONFIG,
  POSES,
  type PoseAngles,
  type RigGeometryConfig,
} from "./character-rig-constants";
import {
  walkT,
  mixPose,
  computeCharacterAStride,
  computeFootDy,
} from "./pose-math";
import {
  renderCharacterASideSvg,
  renderCharacterAFrontSvg,
} from "./character-a-svg";
import {
  renderCharacterBSideSvg,
  renderCharacterBFrontSvg,
} from "./character-b-svg";
import type {
  CharacterAdapterOptions,
  CharacterVariant,
  ReadonlyPlayerPhysicsState,
} from "./character-types";

export type AdapterPoseName =
  | "STAND"
  | "CROUCH"
  | "RISE"
  | "APEX"
  | "FALL"
  | "LAND"
  | "WALK"
  | "WIN"
  | "FAIL";

export class CharacterAnimationAdapter {
  private readonly variant: CharacterVariant;
  private readonly reducedMotion: boolean;
  private readonly geom: RigGeometryConfig;
  private readonly stride: number;

  private currentPoseName: AdapterPoseName = "STAND";
  private curPose: PoseAngles = [...POSES.STAND] as unknown as PoseAngles;
  private walkPhase: number = 0;
  private wasGrounded: boolean = true;
  private landTimer: number = 0;
  private landIntensity: number = 0;
  private airBlend: number = 0;
  private disposed: boolean = false;

  constructor(options: CharacterAdapterOptions = {}) {
    this.variant = options.variant ?? "A";
    this.reducedMotion = options.reducedMotion ?? false;
    this.geom =
      this.variant === "B" ? CHARACTER_B_CONFIG : CHARACTER_A_CONFIG;
    this.stride = computeCharacterAStride();
  }

  public getVariant(): CharacterVariant {
    return this.variant;
  }

  public getCurrentPoseName(): AdapterPoseName {
    return this.currentPoseName;
  }

  public getWalkPhase(): number {
    return this.walkPhase;
  }

  public getCurrentPoseAngles(): PoseAngles {
    return this.curPose;
  }

  public getAirBlend(): number {
    return this.airBlend;
  }

  public update(state: ReadonlyPlayerPhysicsState, dt: number): void {
    if (this.disposed) return;

    // Terminal phase overrides
    if (state.terminalPhase === "win") {
      this.currentPoseName = "WIN";
      this.curPose = POSES.STAND;
      return;
    }
    if (state.terminalPhase === "fail") {
      this.currentPoseName = "FAIL";
      this.curPose = POSES.CROUCH;
      return;
    }

    if (this.reducedMotion) {
      if (state.grounded) {
        this.currentPoseName = "STAND";
        this.curPose = POSES.STAND;
        this.airBlend = 0;
      } else {
        if (state.vy < -150) this.currentPoseName = "RISE";
        else if (state.vy > 150) this.currentPoseName = "FALL";
        else this.currentPoseName = "APEX";
        this.curPose =
          this.currentPoseName === "RISE"
            ? POSES.RISE
            : this.currentPoseName === "FALL"
            ? POSES.FALL
            : POSES.APEX;
        this.airBlend = 1;
      }
      return;
    }

    // Landing detection
    if (state.grounded && !this.wasGrounded) {
      const imp = Math.max(0.15, Math.min(1.25, Math.abs(state.vy) / 600 || 0.5));
      this.landTimer = 0.08 + 0.07 * imp;
      this.landIntensity = imp;
    }
    this.wasGrounded = state.grounded;

    let targetPose: PoseAngles = POSES.STAND;
    let k = 22;

    if (!state.grounded) {
      // In air: RISE -> APEX -> FALL based on vy
      const t = Math.max(-1, Math.min(1, state.vy / 600));
      if (t < -0.2) {
        this.currentPoseName = "RISE";
        targetPose = mixPose(POSES.RISE, POSES.APEX, t + 1);
      } else if (t > 0.2) {
        this.currentPoseName = "FALL";
        targetPose = mixPose(POSES.APEX, POSES.FALL, t);
      } else {
        this.currentPoseName = "APEX";
        targetPose = POSES.APEX;
      }
      k = 18;
    } else if (this.landTimer > 0) {
      this.landTimer -= dt;
      this.currentPoseName = "LAND";
      targetPose = mixPose(
        POSES.STAND,
        POSES.LAND,
        0.35 + 0.65 * Math.min(1, this.landIntensity)
      );
      k = 30;
    } else {
      // Grounded: check horizontal movement
      const effectiveVx =
        state.resolvedVx !== undefined ? state.resolvedVx : state.vx;
      const isMoving = Math.abs(effectiveVx) > 8;

      if (isMoving) {
        this.currentPoseName = "WALK";
        this.walkPhase += (Math.abs(effectiveVx) * dt) / this.stride;
        targetPose = walkT(this.walkPhase);
        k = 60;
      } else {
        this.currentPoseName = "STAND";
        targetPose = POSES.STAND;
        k = 22;
      }
    }

    // Exponential smoothing
    const f = 1 - Math.exp(-k * dt);
    this.curPose = mixPose(this.curPose, targetPose, f);

    // Air blend smoothing
    const targetAir = state.grounded ? 0 : 1;
    this.airBlend += (targetAir - this.airBlend) * (1 - Math.exp(-30 * dt));
  }

  public renderSvg(facing: 1 | -1 = 1): string {
    if (this.currentPoseName === "WIN") {
      return this.variant === "B"
        ? renderCharacterBFrontSvg(false)
        : renderCharacterAFrontSvg(false);
    }

    const sideSvg =
      this.variant === "B"
        ? renderCharacterBSideSvg(this.curPose, this.airBlend)
        : renderCharacterASideSvg(this.curPose, this.airBlend);

    return sideSvg;
  }

  public reset(): void {
    this.currentPoseName = "STAND";
    this.curPose = [...POSES.STAND] as unknown as PoseAngles;
    this.walkPhase = 0;
    this.wasGrounded = true;
    this.landTimer = 0;
    this.landIntensity = 0;
    this.airBlend = 0;
  }

  public dispose(): void {
    this.disposed = true;
    this.reset();
  }
}
