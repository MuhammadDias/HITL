/**
 * Momo's cloth wings: only the lower tips (the "feet" of the triangle) move, up and down.
 *
 * The wing is attached to the body along its upper edge A→B (A = the apex at the body corner, B = the end of the
 * attach edge). A rotation about a pivot would lift that edge off the body and make the wing look cut off, so the
 * motion is a shear instead: every point slides along A→B by an amount proportional to its distance from that edge.
 * Points on the edge have distance 0, so A, B and everything between them never move. Positive angle = tips droop
 * down, negative = tips lift. The art is drawn in the 1389 x 2058 Momo viewBox.
 */
export type WingSide = "L" | "R";

interface WingGeometry {
  /** Apex, attached to the body (fixed). */
  a: readonly [number, number];
  /** Far end of the attach edge (fixed). */
  b: readonly [number, number];
  /** A point on the free tip, only used to orient the normal toward the tips. */
  tip: readonly [number, number];
}

export const WING_GEOMETRY: Record<WingSide, WingGeometry> = {
  L: { a: [151.7, 599.3], b: [184.4, 767.4], tip: [110, 940] },
  R: { a: [1254.9, 646.8], b: [1196.4, 775.4], tip: [1306, 917] },
};

/** Largest vertical travel of a wing tip, in art units, at the full angle. */
export const WING_MAX_SHIFT = 56;
/** Angle (degrees) that maps to WING_MAX_SHIFT. */
export const WING_FULL_ANGLE = 32;
/** The wing never bends past this angle (the wave hello may go beyond the everyday 32). */
export const WING_LIMIT_ANGLE = 50;

function frame(side: WingSide) {
  const { a, b, tip } = WING_GEOMETRY[side];
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const ux = (b[0] - a[0]) / len, uy = (b[1] - a[1]) / len;
  let nx = -uy, ny = ux;
  if (nx * (tip[0] - a[0]) + ny * (tip[1] - a[1]) < 0) { nx = -nx; ny = -ny; }
  const dTip = nx * (tip[0] - a[0]) + ny * (tip[1] - a[1]);
  return { a, ux, uy, nx, ny, dTip };
}

/** Maps a point of the wing artwork to where the shear puts it. Used by tests and by the matrix below. */
export function wingPoint(side: WingSide, angleDeg: number, p: readonly [number, number]): [number, number] {
  const f = frame(side);
  const k = shearFactor(f.dTip, angleDeg);
  const d = f.nx * (p[0] - f.a[0]) + f.ny * (p[1] - f.a[1]);
  return [p[0] + k * d * f.ux, p[1] + k * d * f.uy];
}

function shearFactor(dTip: number, angleDeg: number): number {
  const t = Math.max(-WING_LIMIT_ANGLE, Math.min(WING_LIMIT_ANGLE, angleDeg)) / WING_FULL_ANGLE;
  return (t * WING_MAX_SHIFT) / dTip;
}

/** SVG `transform` value that bends the wing at its tips while the apex and the attach edge stay put. */
export function wingTransform(side: WingSide, angleDeg: number): string {
  const f = frame(side);
  const k = shearFactor(f.dTip, angleDeg);
  const a = 1 + k * f.ux * f.nx, c = k * f.ux * f.ny, b = k * f.uy * f.nx, d = 1 + k * f.uy * f.ny;
  const e = f.a[0] - a * f.a[0] - c * f.a[1], g = f.a[1] - b * f.a[0] - d * f.a[1];
  const r = (n: number) => n.toFixed(8);
  return `matrix(${r(a)} ${r(b)} ${r(c)} ${r(d)} ${r(e)} ${r(g)})`;
}
