/**
 * Rig constants and geometries extracted directly from original stickman-ab.html
 * Source SHA256: eeb97ac0f4f02c9a2b09dfe572a43d16e346a84d7cf01daea099888c3d457e2c
 * Faithful to lines 70-156 without modifications or invented approximations.
 */

export const DEG_TO_RAD = Math.PI / 180;
export const TAU = Math.PI * 2;

export const CHARACTER_B_K = {
  KX: 253.1,
  KY: 905,
  AX: 261.7,
  AY: 1026,
  JR: 6.6,
  SPX: 257,
  SPY: 418,
  ALPHA: 17,
  LPX: 251,
  LPY: 783,
} as const;

export interface RigGeometryConfig {
  readonly Lt: number;
  readonly Ls: number;
  readonly H: number;
  readonly cx: number;
  readonly S: number;
  readonly W: number;
  readonly vb: string;
  readonly gl: readonly [number, number, number];
  readonly gw: number;
}

export const CHARACTER_A_CONFIG: RigGeometryConfig = {
  Lt: 44,
  Ls: 48,
  H: 391,
  cx: 104,
  S: 0.95,
  W: 208,
  vb: "-6 0 212 402",
  gl: [10, 198, 392],
  gw: 3,
} as const;

export const CHARACTER_B_CONFIG: RigGeometryConfig = {
  Lt: CHARACTER_B_K.KY - CHARACTER_B_K.LPY, // 122
  Ls: CHARACTER_B_K.AY - CHARACTER_B_K.KY,  // 121
  H: 1048,
  cx: 195,
  S: 0.36,
  W: 390,
  vb: "-8 -8 410 1069",
  gl: [10, 384, 1052],
  gw: 5,
} as const;

/**
 * Pose format: [thigh_near, knee_near, thigh_far, knee_far, arm_near, arm_far, head_tilt]
 * Angles in degrees. Negative = forward rotation.
 */
export type PoseAngles = readonly [number, number, number, number, number, number, number];

export const POSES = {
  STAND: [-7, 2, 8, 3, 6.8, -6, 0],
  CROUCH: [-46, 90, -40, 84, 38, 34, 5],
  RISE: [-60, 95, -14, 58, -125, -98, -4],
  APEX: [-72, 102, -38, 78, -105, -75, 0],
  FALL: [-18, 20, 8, 24, -62, 24, 3],
  LAND: [-50, 96, -42, 88, -26, -14, 7],
} as const satisfies Record<string, PoseAngles>;
