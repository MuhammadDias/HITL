import type { Landmark } from "./types";

/**
 * Gesture UX Upgrade — MediaPipe Hands Gesture State Machine & Landmark Math.
 * Based on approved UX research blueprint (RESEARCH_GESTURE_UX.md).
 *
 * Features:
 * 1. Pre-pinch cursor preview (Buxton Three-State Model: Out of Range -> Hover -> Inking).
 * 2. Anatomically normalized pinch hysteresis (Schmitt Trigger: close <= 0.40, open >= 0.55).
 * 3. Single-hand V-sign (Peace Sign) undo gesture with 400ms dwell confirmation.
 * 4. Micro-tap debounce & 100ms tracking-loss buffer support.
 *
 * Landmarks map to MediaPipe 21-point hand skeleton in normalized [0..1] camera coordinates.
 * Mirrored x (1-x) aligns the cursor with the student's visual preview.
 */

export const LANDMARK_INDEX = {
  WRIST: 0,
  THUMB_CMC: 1,
  THUMB_MCP: 2,
  THUMB_IP: 3,
  THUMB_TIP: 4,
  INDEX_MCP: 5,
  INDEX_PIP: 6,
  INDEX_DIP: 7,
  INDEX_TIP: 8,
  MIDDLE_MCP: 9,
  MIDDLE_PIP: 10,
  MIDDLE_DIP: 11,
  MIDDLE_TIP: 12,
  RING_MCP: 13,
  RING_PIP: 14,
  RING_DIP: 15,
  RING_TIP: 16,
  PINKY_MCP: 17,
  PINKY_PIP: 18,
  PINKY_DIP: 19,
  PINKY_TIP: 20,
} as const;

// Backward-compatible landmark constants
export const INDEX_TIP = 8;
export const THUMB_TIP = 4;
export const WRIST = 0;
export const MIDDLE_MCP = 9;

export interface GestureThresholds {
  /** Normalized pinch distance threshold to enter inking (D_close). Default: 0.40 */
  pinchClose: number;
  /** Normalized pinch distance threshold to exit inking (D_open). Default: 0.55 */
  pinchOpen: number;
  /** Dwell confirmation duration in ms for V-sign undo gesture. Default: 400 ms */
  undoDwellMs: number;
  /** Minimum stroke path length in px. Default: 6 px */
  minStrokeLengthPx: number;
  /** Minimum stroke duration in ms. Default: 80 ms */
  minStrokeDurationMs: number;
  /** Tracking-loss grace buffer duration in ms. Default: 100 ms */
  trackingLossGraceMs: number;
}

export const DEFAULT_GESTURE_THRESHOLDS: GestureThresholds = {
  pinchClose: 0.40,
  pinchOpen: 0.55,
  undoDwellMs: 400,
  minStrokeLengthPx: 6,
  minStrokeDurationMs: 80,
  trackingLossGraceMs: 100,
};

export type GestureStateKind = "lost" | "hover" | "drawing" | "undo-pending" | "undo-triggered";

export interface GestureEvaluationResult {
  state: GestureStateKind;
  /** Mirrored and clamped normalized cursor coordinates [0..1] */
  cursor: { x: number; y: number };
  /** Normalized Euclidean pinch distance: ||P4 - P8|| / ||P9 - P0|| */
  normalizedPinchDistance: number;
  /** Feedforward proximity ratio: 0.0 (at/open beyond pinchOpen) to 1.0 (touching at/below pinchClose) */
  proximityRatio: number;
  /** Circular dwell gauge fill ratio: 0.0 to 1.0 */
  undoProgress: number;
  /** Boolean pinch flag for backward compatibility */
  pinched: boolean;
}

/** Mirrored + clamped normalized position of the index fingertip (L8). */
export function indexTipNormalized(landmarks: Landmark[]): { x: number; y: number } {
  const tip = landmarks[LANDMARK_INDEX.INDEX_TIP] ?? landmarks[0];
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
 * Calculates anatomically normalized pinch distance using the rigid palm span
 * (Wrist L0 -> Middle MCP L9) as the reference baseline.
 */
export function calculateNormalizedPinch(landmarks: Landmark[]): {
  normalizedPinch: number;
  palmSpan: number;
  rawPinch: number;
} {
  const thumb = landmarks[LANDMARK_INDEX.THUMB_TIP];
  const index = landmarks[LANDMARK_INDEX.INDEX_TIP];
  const wrist = landmarks[LANDMARK_INDEX.WRIST];
  const middleMcp = landmarks[LANDMARK_INDEX.MIDDLE_MCP];

  if (!thumb || !index || !wrist || !middleMcp) {
    return { normalizedPinch: 1.0, palmSpan: 0, rawPinch: 0 };
  }

  const palmSpan = Math.hypot(wrist.x - middleMcp.x, wrist.y - middleMcp.y);
  const effectiveSpan = Math.max(palmSpan, 1e-5);
  const rawPinch = Math.hypot(thumb.x - index.x, thumb.y - index.y);
  const normalizedPinch = rawPinch / effectiveSpan;

  return { normalizedPinch, palmSpan: effectiveSpan, rawPinch };
}

/**
 * Evaluates whether the hand is pinched based on normalized pinch ratio.
 * Default threshold is pinchClose (0.40).
 */
export function isPinched(landmarks: Landmark[], threshold = DEFAULT_GESTURE_THRESHOLDS.pinchClose): boolean {
  const { normalizedPinch } = calculateNormalizedPinch(landmarks);
  return normalizedPinch <= threshold;
}

/**
 * Hand Gesture State Machine.
 * Evaluates per-frame MediaPipe landmarks using the Buxton 3-State Model,
 * dual-threshold Schmitt trigger hysteresis, and V-sign undo dwell logic.
 */
export class HandGestureStateMachine {
  private isPinchedState = false;
  private undoStartTime: number | null = null;
  private undoFired = false;
  private thresholds: GestureThresholds;

  constructor(thresholds: Partial<GestureThresholds> = {}) {
    this.thresholds = { ...DEFAULT_GESTURE_THRESHOLDS, ...thresholds };
  }

  reset(): void {
    this.isPinchedState = false;
    this.undoStartTime = null;
    this.undoFired = false;
  }

  evaluate(landmarks: Landmark[] | undefined, timestampMs?: number): GestureEvaluationResult {
    const now = timestampMs ?? (typeof performance !== "undefined" ? performance.now() : Date.now());

    if (!landmarks || landmarks.length < 21) {
      this.reset();
      return {
        state: "lost",
        cursor: { x: 0.5, y: 0.5 },
        normalizedPinchDistance: 1.0,
        proximityRatio: 0,
        undoProgress: 0,
        pinched: false,
      };
    }

    // 1. Calculate mirrored index fingertip cursor (L8)
    const cursor = indexTipNormalized(landmarks);

    // 2. Calculate anatomically normalized pinch distance
    const { normalizedPinch, palmSpan } = calculateNormalizedPinch(landmarks);

    // 3. Proximity feedforward is tied directly to the Schmitt interval: it
    // remains 0 while the tips are open and reaches 1 exactly at contact.
    const proximityRatio = proximityFromPinch(
      normalizedPinch,
      this.thresholds.pinchClose,
      this.thresholds.pinchOpen,
    );

    // 4. V-Sign Undo gesture detection (L8 + L12 extended, L16 + L20 curled, D_pinch > 0.60)
    const isVSign = this.detectVSign(landmarks, palmSpan, normalizedPinch);

    if (isVSign && !this.isPinchedState) {
      if (this.undoStartTime === null) {
        this.undoStartTime = now;
        this.undoFired = false;
      }
      const elapsed = now - this.undoStartTime;
      const undoProgress = Math.min(elapsed / this.thresholds.undoDwellMs, 1.0);

      if (undoProgress >= 1.0) {
        if (!this.undoFired) {
          this.undoFired = true;
          return {
            state: "undo-triggered",
            cursor,
            normalizedPinchDistance: normalizedPinch,
            proximityRatio,
            undoProgress: 1.0,
            pinched: false,
          };
        }
        return {
          state: "undo-pending",
          cursor,
          normalizedPinchDistance: normalizedPinch,
          proximityRatio,
          undoProgress: 1.0,
          pinched: false,
        };
      }

      return {
        state: "undo-pending",
        cursor,
        normalizedPinchDistance: normalizedPinch,
        proximityRatio,
        undoProgress,
        pinched: false,
      };
    } else {
      this.undoStartTime = null;
      this.undoFired = false;
    }

    // 5. Schmitt Trigger Hysteresis for Drawing
    if (this.isPinchedState) {
      if (normalizedPinch >= this.thresholds.pinchOpen - 1e-6) {
        this.isPinchedState = false;
      }
    } else {
      if (normalizedPinch <= this.thresholds.pinchClose + 1e-6) {
        this.isPinchedState = true;
      }
    }

    return {
      state: this.isPinchedState ? "drawing" : "hover",
      cursor,
      normalizedPinchDistance: normalizedPinch,
      proximityRatio,
      undoProgress: 0,
      pinched: this.isPinchedState,
    };
  }

  private detectVSign(landmarks: Landmark[], palmSpan: number, normalizedPinch: number): boolean {
    if (normalizedPinch <= 0.60) return false;

    const l = landmarks;
    const indexTip = l[LANDMARK_INDEX.INDEX_TIP];
    const indexPip = l[LANDMARK_INDEX.INDEX_PIP];
    const middleTip = l[LANDMARK_INDEX.MIDDLE_TIP];
    const middlePip = l[LANDMARK_INDEX.MIDDLE_PIP];
    const ringTip = l[LANDMARK_INDEX.RING_TIP];
    const ringPip = l[LANDMARK_INDEX.RING_PIP];
    const pinkyTip = l[LANDMARK_INDEX.PINKY_TIP];
    const pinkyPip = l[LANDMARK_INDEX.PINKY_PIP];

    if (!indexTip || !indexPip || !middleTip || !middlePip || !ringTip || !ringPip || !pinkyTip || !pinkyPip) {
      return false;
    }

    // Index (L8) and Middle (L12) extended: tip y < pip y (in screen coordinates)
    const indexExtended = indexTip.y < indexPip.y;
    const middleExtended = middleTip.y < middlePip.y;

    // Ring (L16) and Pinky (L20) curled: tip y > pip y
    const ringCurled = ringTip.y > ringPip.y;
    const pinkyCurled = pinkyTip.y > pinkyPip.y;

    // Finger separation between Index Tip and Middle Tip
    const fingerGap = Math.hypot(indexTip.x - middleTip.x, indexTip.y - middleTip.y);
    const isSeparated = fingerGap >= 0.18 * palmSpan;

    return indexExtended && middleExtended && ringCurled && pinkyCurled && isSeparated;
  }
}

/** Standalone evaluator for backward compatibility. */
const globalStateMachine = new HandGestureStateMachine();

export function evaluateGesture(
  landmarks: Landmark[] | undefined,
  timestampMs?: number,
): GestureEvaluationResult {
  return globalStateMachine.evaluate(landmarks, timestampMs);
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(Math.max(n, lo), hi);
}

function proximityFromPinch(normalizedPinch: number, pinchClose: number, pinchOpen: number): number {
  const interval = Math.max(pinchOpen - pinchClose, Number.EPSILON);
  return clamp01((pinchOpen - normalizedPinch) / interval);
}

function clamp01(n: number): number {
  return clamp(n, 0, 1);
}

