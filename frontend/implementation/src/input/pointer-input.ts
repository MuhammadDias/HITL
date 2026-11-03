import type { DrawingInput } from "../domain/types";
import { normalizeStrokes } from "./normalize";

/**
 * TASK 06 — Pointer/touch driver (the always-available fallback input).
 * Pushes raw canvas-space points into the shared StrokeStore.
 */
export function attachPointerDriver(
  canvas: HTMLCanvasElement,
  store: import("./types").StrokeStore,
  onRender: () => void,
  onCursor?: (c: { x: number; y: number; state: "hover" | "near" | "drawing" } | null) => void,
): () => void {
  let active = false;

  const pointOf = (e: PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const onDown = (e: PointerEvent) => {
    e.preventDefault();
    active = true;
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      /* capture is best-effort */
    }
    const p = pointOf(e);
    store.beginStroke();
    store.addPoint(p);
    onCursor?.({ x: p.x, y: p.y, state: "drawing" });
    onRender();
  };
  const onMove = (e: PointerEvent) => {
    const p = pointOf(e);
    if (active) {
      e.preventDefault();
      store.addPoint(p);
      onCursor?.({ x: p.x, y: p.y, state: "drawing" });
      onRender();
    } else {
      onCursor?.({ x: p.x, y: p.y, state: "hover" });
    }
  };
  const onUp = (e?: PointerEvent) => {
    if (!active) return;
    active = false;
    store.endStroke();
    if (e) {
      const p = pointOf(e);
      onCursor?.({ x: p.x, y: p.y, state: "hover" });
    } else {
      onCursor?.(null);
    }
    onRender();
  };
  const onLeave = () => {
    if (!active) {
      onCursor?.(null);
    }
  };

  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", onUp);
  canvas.addEventListener("pointerleave", onLeave);

  return () => {
    if (active) store.endStroke();
    onCursor?.(null);
    canvas.removeEventListener("pointerdown", onDown);
    canvas.removeEventListener("pointermove", onMove);
    canvas.removeEventListener("pointerup", onUp);
    canvas.removeEventListener("pointercancel", onUp);
    canvas.removeEventListener("pointerleave", onLeave);
  };
}

/** Normalized provider input from the current store contents. */
export function strokesToDrawingInput(store: import("./types").StrokeStore): DrawingInput {
  const { completed, active } = store.getStrokes();
  const all = active ? [...completed, active] : completed;
  return normalizeStrokes(all);
}
