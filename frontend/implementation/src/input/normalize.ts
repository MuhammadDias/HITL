import type { DrawingInput } from "../domain/types.js";

/** Raw stroke as captured from pointer events (canvas pixel space). */
export type RawStroke = Array<{ x: number; y: number }>;

/**
 * FR-01: interface-side preprocessing. Normalizes raw canvas strokes into a
 * modality-independent DrawingInput:
 * - drops tiny jitter strokes;
 * - bbox-normalizes geometry to [0,1] preserving aspect ratio (letterboxed);
 * - resamples points to reduce payload size.
 * A MediaPipe/finger-tracking input source can produce the same shape later.
 */
export function normalizeStrokes(
  strokes: RawStroke[],
  options?: { minPoints?: number; minExtentPx?: number; maxPointsPerStroke?: number },
): DrawingInput {
  const minPoints = options?.minPoints ?? 2;
  const minExtent = options?.minExtentPx ?? 3;
  const maxPoints = options?.maxPointsPerStroke ?? 64;

  const kept: RawStroke[] = [];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const stroke of strokes) {
    if (stroke.length < minPoints) continue;
    kept.push(stroke);
    for (const p of stroke) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
  }

  if (kept.length === 0) {
    return { strokes: [], hasInk: false, aspectRatio: 1 };
  }

  const w = Math.max(maxX - minX, 1);
  const h = Math.max(maxY - minY, 1);
  const scale = Math.max(w, h); // letterbox into the unit square

  const normalized = kept.map((stroke) => {
    const step = Math.max(1, Math.ceil(stroke.length / maxPoints));
    const pts: Array<{ x: number; y: number }> = [];
    for (let i = 0; i < stroke.length; i += step) {
      const p = stroke[i]!;
      const nx = extent(p.x - minX, w, scale);
      const ny = extent(p.y - minY, h, scale);
      // Skip degenerate strokes whose whole extent is below the noise floor.
      pts.push({ x: round4(nx), y: round4(ny) });
    }
    return pts;
  });

  const meaningful = normalized.filter((s) => {
    const xs = s.map((p) => p.x);
    const ys = s.map((p) => p.y);
    return Math.max(...xs) - Math.min(...xs) >= minExtent / scale || Math.max(...ys) - Math.min(...ys) >= minExtent / scale || s.length >= minPoints;
  });

  return {
    strokes: meaningful,
    hasInk: meaningful.length > 0,
    aspectRatio: round4(w / h),
  };
}

function extent(delta: number, span: number, scale: number): number {
  // Center letterbox: offset by half the leftover space.
  return (delta + (scale - span) / 2) / scale;
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
