import type { Point, Rect, StageGeometry } from './stage-geometry';
export type { Point, Rect, StageGeometry } from './stage-geometry';

type ClientBounds = Rect | { left: number; top: number; width: number; height: number };

/** Centered uniform crop, identical to SVG xMidYMid slice. */
function slice(source: StageGeometry['source'], width: number, height: number) {
  const scale = Math.max(width / source.width, height / source.height);
  return { scale, x: (width - source.width * scale) / 2, y: (height - source.height * scale) / 2 };
}
export function sourceToPhysics(point: Point, geometry: StageGeometry): Point {
  const t = slice(geometry.source, geometry.world.width, geometry.world.height);
  return { x: point.x * t.scale + t.x, y: point.y * t.scale + t.y };
}
export function physicsToSource(point: Point, geometry: StageGeometry): Point {
  const t = slice(geometry.source, geometry.world.width, geometry.world.height);
  return { x: (point.x - t.x) / t.scale, y: (point.y - t.y) / t.scale };
}
/** Artwork content bounds in CSS pixels (no DPR), DOMRect or shared Rect.
 * Slice original SVG at client aspect, avoiding double cropping of physics world.
 * Offscreen points remain unclamped; placement policy belongs to runtime.
 */
export function clientToPhysics(point: Point, rect: ClientBounds, geometry: StageGeometry): Point {
  const b = 'left' in rect ? { x: rect.left, y: rect.top, w: rect.width, h: rect.height } : rect;
  const t = slice(geometry.source, b.w, b.h);
  return sourceToPhysics({ x: (point.x - b.x - t.x) / t.scale, y: (point.y - b.y - t.y) / t.scale }, geometry);
}
export function physicsToClient(point: Point, rect: ClientBounds, geometry: StageGeometry): Point {
  const b = 'left' in rect ? { x: rect.left, y: rect.top, w: rect.width, h: rect.height } : rect;
  const t = slice(geometry.source, b.w, b.h);
  const source = physicsToSource(point, geometry);
  return { x: b.x + t.x + source.x * t.scale, y: b.y + t.y + source.y * t.scale };
}
