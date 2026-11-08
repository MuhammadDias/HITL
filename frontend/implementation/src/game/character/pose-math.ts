import {
  CHARACTER_A_CONFIG,
  DEG_TO_RAD,
  TAU,
  type PoseAngles,
  type RigGeometryConfig,
} from "./character-rig-constants";

/**
 * Leg angle calculation from original stickman-ab.html lines 158-161.
 * @param p Walk phase normalized [0, 1)
 * @returns [thighAngleDeg, shinAngleDeg]
 */
export function legAngles(p: number): readonly [number, number] {
  const normP = ((p % 1) + 1) % 1;
  const thigh = -3 - 24 * Math.cos(TAU * normP);
  const shin =
    4 +
    (normP < 0.5
      ? 7 * Math.sin(TAU * normP)
      : 52 * Math.sin(TAU * (normP - 0.5)));
  return [thigh, shin] as const;
}

/**
 * Full body 7-angle pose generation for walk cycle from stickman-ab.html line 162.
 */
export function walkT(p: number): PoseAngles {
  const a = legAngles(p);
  const b = legAngles(p + 0.5);
  return [
    a[0],
    a[1],
    b[0],
    b[1],
    0.85 * b[0],
    0.85 * a[0],
    1.4 * Math.sin(TAU * 2 * p),
  ] as const;
}

/**
 * Linearly interpolate two pose arrays (mix from line 157).
 */
export function mixPose(
  a: PoseAngles | readonly number[],
  b: PoseAngles | readonly number[],
  t: number
): PoseAngles {
  return [
    a[0]! + (b[0]! - a[0]!) * t,
    a[1]! + (b[1]! - a[1]!) * t,
    a[2]! + (b[2]! - a[2]!) * t,
    a[3]! + (b[3]! - a[3]!) * t,
    a[4]! + (b[4]! - a[4]!) * t,
    a[5]! + (b[5]! - a[5]!) * t,
    a[6]! + (b[6]! - a[6]!) * t,
  ] as const;
}

/**
 * Compute horizontal forward foot displacement for stride math (line 187).
 */
export function fx(
  geom: RigGeometryConfig,
  legAngle: readonly [number, number]
): number {
  return -(
    geom.Lt * Math.sin(legAngle[0] * DEG_TO_RAD) +
    geom.Ls * Math.sin((legAngle[0] + legAngle[1]) * DEG_TO_RAD)
  );
}

/**
 * Compute stride distance (px per walk cycle) for Character A without slipping (line 188).
 */
export function computeCharacterAStride(): number {
  const geom = CHARACTER_A_CONFIG;
  const fx0 = fx(geom, legAngles(0));
  const fx05 = fx(geom, legAngles(0.5));
  return 2 * (fx0 - fx05) * geom.S;
}

/**
 * Compute vertical foot ground displacement compensation dy (line 165-166).
 * Keeps the lowest foot planted exactly at the ground line when grounded.
 */
export function computeFootDy(
  geom: RigGeometryConfig,
  pose: PoseAngles | readonly number[],
  airRatio: number = 0
): number {
  const yContact = (thigh: number, shin: number) =>
    geom.Lt * Math.cos(thigh * DEG_TO_RAD) +
    geom.Ls * Math.cos((thigh + shin) * DEG_TO_RAD);

  const yA = yContact(pose[0]!, pose[1]!);
  const yB = yContact(pose[2]!, pose[3]!);
  const maxY = Math.max(yA, yB);

  return (1 - airRatio) * (geom.Lt + geom.Ls - maxY);
}
