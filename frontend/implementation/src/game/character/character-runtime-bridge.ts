/**
 * CharacterRuntimeBridge
 * Links KAPLAY Player Controller read-only physics state to Character A presentation.
 * Pre-bakes a finite, bounded discrete keyframe atlas to avoid per-frame WebGL texture generation.
 * Aligns feet contact at bottom of collider (y=40) without altering physics coordinate space.
 */

import {
  CHARACTER_A_CONFIG,
  POSES,
} from "./character-rig-constants";
import {
  renderCharacterASideSvg,
  renderCharacterAFrontSvg,
} from "./character-a-svg";
import {
  walkT,
  computeCharacterAStride,
} from "./pose-math";
import type {
  ReadonlyPlayerPhysicsState,
  CharacterAdapterOptions,
} from "./character-types";

export type CharacterKeyframeFrameId =
  | "STAND"
  | "CROUCH"
  | "RISE"
  | "APEX"
  | "FALL"
  | "LAND"
  | "WIN"
  | "FAIL"
  | `WALK_${number}`;

export interface CharacterKeyframeAsset {
  readonly frameId: CharacterKeyframeFrameId;
  readonly svg: string;
  readonly dataUri: string;
}

export interface VisualTransform {
  readonly scale: number;
  readonly anchorX: number;
  readonly anchorY: number;
  readonly offsetX: number;
  readonly offsetY: number;
  readonly spriteWidth: number;
  readonly spriteHeight: number;
}

export function buildCharacterAKeyframeManifest(textureScale: number = 2): readonly CharacterKeyframeAsset[] {
  const cfg = CHARACTER_A_CONFIG;
  const manifest: CharacterKeyframeAsset[] = [];

  const addFrame = (frameId: CharacterKeyframeFrameId, svgStr: string) => {
    const scaledSvg = svgStr.replace(
      `width="${cfg.W}" height="${cfg.H}"`,
      `width="${cfg.W * textureScale}" height="${cfg.H * textureScale}"`
    );
    const dataUri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(scaledSvg)}`;
    manifest.push({ frameId, svg: scaledSvg, dataUri });
  };

  // Base keyframes
  addFrame("STAND", renderCharacterASideSvg(POSES.STAND, 0));
  addFrame("CROUCH", renderCharacterASideSvg(POSES.CROUCH, 0));
  addFrame("RISE", renderCharacterASideSvg(POSES.RISE, 1));
  addFrame("APEX", renderCharacterASideSvg(POSES.APEX, 1));
  addFrame("FALL", renderCharacterASideSvg(POSES.FALL, 1));
  addFrame("LAND", renderCharacterASideSvg(POSES.LAND, 0));
  addFrame("WIN", renderCharacterAFrontSvg(false));
  addFrame("FAIL", renderCharacterASideSvg(POSES.CROUCH, 0));

  // Discrete walk cycle frames (8 samples across phase 0..1)
  const WALK_SAMPLES = 8;
  for (let i = 0; i < WALK_SAMPLES; i++) {
    const p = i / WALK_SAMPLES;
    const pose = walkT(p);
    addFrame(`WALK_${i}`, renderCharacterASideSvg(pose, 0));
  }

  return Object.freeze(manifest);
}

export class CharacterRuntimeBridge {
  private currentFrameId: CharacterKeyframeFrameId = "STAND";
  private facing: 1 | -1 = 1;
  private walkPhase: number = 0;
  private wasGrounded: boolean = true;
  private landTimer: number = 0;
  private landIntensity: number = 0;
  private disposed: boolean = false;
  private readonly stride: number;
  private readonly reducedMotion: boolean;

  constructor(options: CharacterAdapterOptions = {}) {
    this.stride = computeCharacterAStride();
    this.reducedMotion = options.reducedMotion ?? false;
  }

  public getCurrentFrameId(): CharacterKeyframeFrameId {
    return this.currentFrameId;
  }

  public getFacing(): 1 | -1 {
    return this.facing;
  }

  public isDisposed(): boolean {
    return this.disposed;
  }

  public update(state: ReadonlyPlayerPhysicsState, dt: number): void {
    if (this.disposed) return;

    // Track horizontal intent for facing direction (do not revert to 1 if stationary)
    const effectiveVx =
      state.resolvedVx !== undefined ? state.resolvedVx : state.vx;
    if (effectiveVx > 5) {
      this.facing = 1;
    } else if (effectiveVx < -5) {
      this.facing = -1;
    } else if (state.facing === 1 || state.facing === -1) {
      if (Math.abs(effectiveVx) > 0.1) {
        this.facing = state.facing;
      }
    }

    // Terminal phase overrides
    if (state.terminalPhase === "win") {
      this.currentFrameId = "WIN";
      return;
    }
    if (state.terminalPhase === "fail") {
      this.currentFrameId = "FAIL";
      return;
    }

    if (this.reducedMotion) {
      if (state.grounded) {
        this.currentFrameId = "STAND";
      } else {
        if (state.vy < -150) this.currentFrameId = "RISE";
        else if (state.vy > 150) this.currentFrameId = "FALL";
        else this.currentFrameId = "APEX";
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

    if (!state.grounded) {
      const t = Math.max(-1, Math.min(1, state.vy / 600));
      if (t < -0.2) {
        this.currentFrameId = "RISE";
      } else if (t > 0.2) {
        this.currentFrameId = "FALL";
      } else {
        this.currentFrameId = "APEX";
      }
    } else if (this.landTimer > 0) {
      this.landTimer -= dt;
      this.currentFrameId = "LAND";
    } else {
      const isMoving = Math.abs(effectiveVx) > 8;
      if (isMoving) {
        this.walkPhase = ((this.walkPhase + (Math.abs(effectiveVx) * dt) / this.stride) % 1 + 1) % 1;
        const frameIndex = Math.floor(this.walkPhase * 8) % 8;
        this.currentFrameId = `WALK_${frameIndex}`;
      } else {
        this.currentFrameId = "STAND";
      }
    }
  }

  public computeVisualTransform(opts: {
    colliderWidth: number;
    colliderHeight: number;
    sceneScale?: number;
    textureScale?: number;
    /** Visual size relative to the collider (feet stay on the collider bottom). Default 1. */
    visualScale?: number;
  }): VisualTransform {
    const cfg = CHARACTER_A_CONFIG;
    const sceneScale = opts.sceneScale ?? 1.0;
    const textureScale = opts.textureScale ?? 1;

    const baseScale = (opts.colliderHeight * (opts.visualScale ?? 1)) / cfg.H;
    const totalScale = (baseScale * sceneScale) / textureScale;

    const visualFootX = cfg.cx * baseScale * sceneScale;
    const visualFootY = cfg.H * baseScale * sceneScale;

    return {
      scale: totalScale,
      anchorX: opts.colliderWidth / 2,
      anchorY: opts.colliderHeight,
      offsetX: opts.colliderWidth / 2 - visualFootX,
      offsetY: opts.colliderHeight - visualFootY,
      spriteWidth: cfg.W * textureScale,
      spriteHeight: cfg.H * textureScale,
    };
  }

  public reset(): void {
    this.currentFrameId = "STAND";
    this.facing = 1;
    this.walkPhase = 0;
    this.wasGrounded = true;
    this.landTimer = 0;
    this.landIntensity = 0;
  }

  public dispose(): void {
    this.disposed = true;
    this.reset();
  }
}
