import type { Landmark } from "./types";

/**
 * TASK 05 — Provisional hand-gesture mapping (pure, fully unit-tested).
 *
 * PROVISIONAL GESTURE (not product-final):
 * - index fingertip (landmark 8) drives the cursor;
 * - thumb-index pinch distance toggles ink on/off.
 *
 * MediaPipe landmarks are normalized [0..1] with x measured in the camera's
 * own frame. The preview is mirrored, so we mirror x (1-x) to match what the
 * user sees before mapping onto the drawing canvas.
 */

export const INDEX_TIP = 8;
export const THUMB_TIP = 4;
export const WRIST = 0;
export const MIDDLE_MCP = 9;

export type CursorState = "hover" | "near" | "drawing";

/** Mirrored + clamped normalized position of the index fingertip. */
export function indexTipNormalized(landmarks: Landmark[]): { x: number; y: number } {
  const tip = landmarks[INDEX_TIP] ?? landmarks[0];
  if (!tip) return { x: 0.5, y: 0.5 };
  return { x: clamp01(1 - tip.x), y: clamp01(tip.y) };
}

/** Map a normalized (already mirrored) point onto canvas pixel space with clamping. */
export function mapToCanvas(
  p: { x: number; y: number },
  width: number,
  height: number,
): { x: number; y: number } {
  return {
    x: clamp(Math.round(p.x * width), 0, width),
    y: clamp(Math.round(p.y * height), 0, height),
  };
}

/**
 * Pinch detection normalized by hand size so distance-to-camera matters less.
 * Ratio threshold is DEV-tunable/provisional.
 */
export function isPinched(landmarks: Landmark[], threshold = 0.42): boolean {
  const thumb = landmarks[THUMB_TIP];
  const index = landmarks[INDEX_TIP];
  const wrist = landmarks[WRIST];
  const middleMcp = landmarks[MIDDLE_MCP];
  if (!thumb || !index || !wrist || !middleMcp) return false;
  const span = Math.hypot(wrist.x - middleMcp.x, wrist.y - middleMcp.y);
  if (span <= 1e-6) return false;
  const pinch = Math.hypot(thumb.x - index.x, thumb.y - index.y);
  return pinch / span < threshold;
}

/**
 * Gesture state machine for one processed frame.
 * Handles tracking loss without jump lines: when the hand disappears the
 * caller must end the current stroke; on reacquisition a new stroke begins
 * only after the pinch gesture is asserted again.
 */
export type GestureFrame =
  | {
      state: "tracking";
      cursor: { x: number; y: number };
      pinched: boolean;
      cursorState: CursorState;
      pinchRatio: number;
    }
  | { state: "lost" };

export function evaluateGesture(
  landmarks: Landmark[] | undefined,
): GestureFrame {
  if (!landmarks || landmarks.length < MIDDLE_MCP + 1) {
    return { state: "lost" };
  }
  const thumb = landmarks[THUMB_TIP];
  const index = landmarks[INDEX_TIP];
  const wrist = landmarks[WRIST];
  const middleMcp = landmarks[MIDDLE_MCP];
  if (!thumb || !index || !wrist || !middleMcp) {
    return { state: "lost" };
  }
  const span = Math.hypot(wrist.x - middleMcp.x, wrist.y - middleMcp.y);
  const pinch = Math.hypot(thumb.x - index.x, thumb.y - index.y);
  const pinchRatio = span <= 1e-6 ? 1 : pinch / span;
  const pinched = pinchRatio < 0.42;
  const cursorState: CursorState = pinched ? "drawing" : pinchRatio < 0.55 ? "near" : "hover";

  return {
    state: "tracking",
    cursor: indexTipNormalized(landmarks),
    pinched,
    cursorState,
    pinchRatio,
  };
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(Math.max(n, lo), hi);
}

function clamp01(n: number): number {
  return clamp(n, 0, 1);
}
