import type { DrawingInput, StrokePoint } from "../domain/types.js";

/** Raw stroke as captured from pointer events (canvas pixel space). */
export type RawStroke = StrokePoint[];

/**
 * Normalizes geometry into a centered unit square while preserving each point's
 * width relative to the source bbox. This keeps downstream illustration exports
 * visually faithful without leaking canvas pixels into model input.
 */
export function normalizeStrokes(
  strokes: RawStroke[],
  options?: { minPoints?: number; minExtentPx?: number; maxPointsPerStroke?: number },
): DrawingInput {
  const minPoints = options?.minPoints ?? 2;
  const minExtent = options?.minExtentPx ?? 3;
  // Decimation already removed sub-3px movement during capture. Keep the
  // remaining geometry for the world; a model adapter may explicitly resample.
  const maxPoints = options?.maxPointsPerStroke ?? Infinity;
  const kept = strokes.filter((stroke) => stroke.length >= minPoints);
  if (kept.length === 0) return { strokes: [], hasInk: false, aspectRatio: 1 };

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const stroke of kept) for (const point of stroke) {
    minX = Math.min(minX, point.x); minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x); maxY = Math.max(maxY, point.y);
  }
  const width = Math.max(maxX - minX, 1);
  const height = Math.max(maxY - minY, 1);
  const scale = Math.max(width, height);

  const normalized = kept.map((stroke) => {
    const step = Math.max(1, Math.ceil(stroke.length / maxPoints));
    const points: StrokePoint[] = [];
    for (let i = 0; i < stroke.length; i += step) {
      const point = stroke[i]!;
      points.push({
        x: round4(centered(point.x - minX, width, scale)),
        y: round4(centered(point.y - minY, height, scale)),
        ...(typeof point.width === "number" ? { width: round4(point.width / scale) } : {}),
        ...(typeof point.opacity === "number" ? { opacity: clamp01(point.opacity) } : {}),
      });
    }
    const last = stroke[stroke.length - 1];
    if (last && points.length > 0 && points[points.length - 1] !== last) {
      // Preserve the endpoint when resampling did not land on it.
      const previous = points[points.length - 1]!;
      if (previous.x !== round4(centered(last.x - minX, width, scale)) || previous.y !== round4(centered(last.y - minY, height, scale))) {
        points.push({ x: round4(centered(last.x - minX, width, scale)), y: round4(centered(last.y - minY, height, scale)), ...(typeof last.width === "number" ? { width: round4(last.width / scale) } : {}), ...(typeof last.opacity === "number" ? { opacity: clamp01(last.opacity) } : {}) });
      }
    }
    return points;
  });

  const meaningful = normalized.filter((stroke) => {
    const xs = stroke.map((point) => point.x);
    const ys = stroke.map((point) => point.y);
    return Math.max(...xs) - Math.min(...xs) >= minExtent / scale || Math.max(...ys) - Math.min(...ys) >= minExtent / scale;
  });
  return { strokes: meaningful, hasInk: meaningful.length > 0, aspectRatio: round4(width / height) };
}

function centered(delta: number, span: number, scale: number): number {
  return (delta + (scale - span) / 2) / scale;
}
function round4(value: number): number { return Math.round(value * 10000) / 10000; }
function clamp01(value: number): number { return Math.max(0, Math.min(1, value)); }
