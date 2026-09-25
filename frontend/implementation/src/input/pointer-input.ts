import type { DrawingInput, StrokePoint } from "../domain/types";
import { normalizeStrokes } from "./normalize";
import type { StrokeStore } from "./types";

export interface PointerDriverOptions {
  onStart?(): void;
  onEnd?(): void;
}

/** Always-on pointer/touch fallback with a single deterministic active pointer. */
export function attachPointerDriver(
  canvas: HTMLCanvasElement,
  store: StrokeStore,
  onRender: () => void,
  options: PointerDriverOptions = {},
): () => void {
  let activePointerId: number | null = null;
  let previousSample: { point: { x: number; y: number }; timestampMs: number } | null = null;

  const pointOf = (event: PointerEvent): { point: { x: number; y: number }; minDistance: number } => {
    const rect = canvas.getBoundingClientRect();
    const scale = rect.width > 0 ? canvas.width / rect.width : 1;
    return {
      point: {
        x: clamp((event.clientX - rect.left) * scale, 0, canvas.width),
        y: clamp((event.clientY - rect.top) * scale, 0, canvas.height),
      },
      minDistance: 3 * scale,
    };
  };

  const inkPointOf = (event: PointerEvent): { point: StrokePoint; minDistance: number; timestampMs: number } => {
    const { point, minDistance } = pointOf(event);
    const timestampMs = eventTimestamp(event);
    const previous = previousSample;
    const seconds = previous ? Math.max((timestampMs - previous.timestampMs) / 1000, 1 / 240) : 1 / 60;
    const rect = canvas.getBoundingClientRect();
    const scale = rect.width > 0 ? canvas.width / rect.width : 1;
    const velocityCss = previous ? Math.hypot(point.x - previous.point.x, point.y - previous.point.y) / scale / seconds : 0;
    const speed = Math.min(1, velocityCss / 1200);
    previousSample = { point, timestampMs };
    return { point: { ...point, width: 12 - 10 * speed, opacity: 1 - 0.55 * speed }, minDistance, timestampMs };
  };

  const addSamples = (event: PointerEvent): number => {
    const samples = event.getCoalescedEvents?.() ?? [event];
    let timestampMs = eventTimestamp(event);
    for (const sample of samples) {
      const ink = inkPointOf(sample);
      store.addPoint(ink.point, ink.minDistance);
      timestampMs = ink.timestampMs;
    }
    return timestampMs;
  };

  const finish = (event?: PointerEvent, cancelled = false) => {
    if (activePointerId === null || (event && event.pointerId !== activePointerId)) return;
    const pointerId = activePointerId;
    activePointerId = null;
    previousSample = null;
    if (cancelled) store.cancelActiveStroke();
    else store.endStroke(event ? eventTimestamp(event) : undefined);
    try {
      canvas.releasePointerCapture(pointerId);
    } catch {
      // capture is best effort
    }
    options.onEnd?.();
    onRender();
  };

  const onDown = (event: PointerEvent) => {
    // A second finger must not splice into the first stroke.
    if (activePointerId !== null || event.button !== 0 || event.isPrimary === false) return;
    event.preventDefault();
    activePointerId = event.pointerId;
    options.onStart?.();
    try {
      canvas.setPointerCapture(event.pointerId);
    } catch {
      // capture is best effort
    }
    const ink = inkPointOf(event);
    store.beginStroke(ink.timestampMs);
    store.addPoint(ink.point, ink.minDistance);
    onRender();
  };
  const onMove = (event: PointerEvent) => {
    if (event.pointerId !== activePointerId) return;
    event.preventDefault();
    addSamples(event);
    onRender();
  };
  const onUp = (event: PointerEvent) => {
    if (event.pointerId === activePointerId) addSamples(event);
    finish(event);
  };
  const onCancel = (event: PointerEvent) => finish(event, true);

  canvas.addEventListener("pointerdown", onDown, { passive: false });
  canvas.addEventListener("pointermove", onMove, { passive: false });
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", onCancel);
  canvas.addEventListener("lostpointercapture", onCancel);

  return () => {
    if (activePointerId !== null) finish(undefined, true);
    canvas.removeEventListener("pointerdown", onDown);
    canvas.removeEventListener("pointermove", onMove);
    canvas.removeEventListener("pointerup", onUp);
    canvas.removeEventListener("pointercancel", onCancel);
    canvas.removeEventListener("lostpointercapture", onCancel);
  };
}

/**
 * Normalized provider input from the current store contents. Geometry is already
 * in backing-canvas pixels, while captured widths remain CSS pixels for live
 * rendering. Convert copied widths to backing pixels before bbox normalization.
 */
export function strokesToDrawingInput(store: StrokeStore, backingPixelsPerCss = 1): DrawingInput {
  const { completed, active } = store.getStrokes();
  const widthScale = Number.isFinite(backingPixelsPerCss) && backingPixelsPerCss > 0 ? backingPixelsPerCss : 1;
  const strokes = active ? [...completed, active] : completed;
  return normalizeStrokes(strokes.map((stroke) => stroke.map((point) => ({
    ...point,
    ...(typeof point.width === "number" ? { width: point.width * widthScale } : {}),
  }))));
}

function eventTimestamp(event: PointerEvent): number {
  return Number.isFinite(event.timeStamp) ? event.timeStamp : (typeof performance !== "undefined" ? performance.now() : Date.now());
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}
