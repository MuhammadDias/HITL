/**
 * Pure AABB helpers for the placeholder consequence scene. No DOM — testable.
 */

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function boxesOverlap(a: Box, b: Box): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/** Horizontal span [minX, maxX) covered by a box. */
export function spanX(b: Box): { min: number; max: number } {
  return { min: b.x, max: b.x + b.w };
}

/** True when a horizontal move from `from` to `to` would cross into `box`. */
export function crossesHorizontally(fromX: number, toX: number, box: Box): boolean {
  return fromX <= box.x && toX >= box.x;
}
