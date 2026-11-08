"use strict";

/**
 * TASK 14 — Provisional gameplay gesture mapping (pure, fully unit-tested).
 * 
 * PROVISIONAL GESTURE (not product-final):
 * - Index fingertip (landmark 8) drives horizontal cursor position for left/right movement
 * - Thumb-index pinch toggles grab/drag (PLACE) in gameplay phase
 * - Mirror x (1-x) to match camera preview mirroring, same as hand-gesture.ts
 * - Zones: left < 0.35, right > 0.65, center stop zone
 * - Pinch threshold reuses existing isPinched logic from hand-gesture.ts
 * 
 * MediaPipe landmarks are normalized [0..1] with x measured in the camera's
 * own frame. The preview is mirrored, so we mirror x (1-x) to match what the
 * user sees before mapping onto gameplay zones.
 */

import { isPinched, indexTipNormalized, evaluateGesture } from "./hand-gesture";
import { PointSmoother } from "./smoothing";
import type { Landmark } from "./types";

export const GAMEPLAY_LEFT_ZONE = 0.35;
export const GAMEPLAY_RIGHT_ZONE = 0.65;
export const GAMEPLAY_PINCH_THRESHOLD = 0.42;

export type GameplayGestureFrame =
  | {
      tracked: true;
      cursor: { x: number; y: number } | null;
      pinched: boolean;
      input: { left: boolean; right: boolean; jump: boolean };
    }
  | { tracked: false; cursor: null; pinched: false; input: { left: false; right: false; jump: false } };

/**
 * Evaluate gameplay gesture from MediaPipe landmarks.
 * Returns normalized cursor position + discrete left/right/jump input.
 * 
 * @param landmarks - MediaPipe hand landmarks (21 points), undefined if no hand detected
 * @returns GameplayGestureFrame with tracked flag, cursor position, pinch state, and discrete input
 */
export function evaluateGameplayGesture(
  landmarks: Landmark[] | undefined,
): GameplayGestureFrame {
  if (!landmarks || landmarks.length < 10) {
    return {
      tracked: false,
      cursor: null,
      pinched: false,
      input: { left: false, right: false, jump: false },
    };
  }

  // Check for NaN or invalid numbers in landmarks
  for (let i = 0; i < 10; i++) {
    const lm = landmarks[i];
    if (!lm || Number.isNaN(lm.x) || Number.isNaN(lm.y)) {
      return {
        tracked: false,
        cursor: null,
        pinched: false,
        input: { left: false, right: false, jump: false },
      };
    }
  }

  const tip = indexTipNormalized(landmarks);
  if (Number.isNaN(tip.x) || Number.isNaN(tip.y)) {
    return {
      tracked: false,
      cursor: null,
      pinched: false,
      input: { left: false, right: false, jump: false },
    };
  }

  const pinched = isPinched(landmarks, GAMEPLAY_PINCH_THRESHOLD);
  
  // Map mirrored cursor x to discrete left/right movement zones
  // Center zone (0.35 - 0.65) = stop
  // Left zone (< 0.35) = move left
  // Right zone (> 0.65) = move right
  const cursorX = tip.x;
  const left = cursorX < GAMEPLAY_LEFT_ZONE;
  const right = cursorX > GAMEPLAY_RIGHT_ZONE;
  
  // Jump is optional for Level 1 - keep false unless explicitly specified/testable
  // Cross-phase crossing not required for Level 1
  const jump = false;

  return {
    tracked: true,
    cursor: { x: tip.x, y: tip.y },
    pinched,
    input: { left, right, jump },
  };
}

/**
 * Map normalized cursor position to gameplay input zones.
 * Separated for unit testing of zone boundaries.
 */
export function cursorToGameplayInput(
  cursorX: number,
  cursorY: number,
  pinched: boolean,
): { left: boolean; right: boolean; jump: boolean } {
  return {
    left: cursorX < GAMEPLAY_LEFT_ZONE,
    right: cursorX > GAMEPLAY_RIGHT_ZONE,
    jump: false, // Level 1: no jump from gesture
  };
}

/* ------------------------------------------------------------------ */
/* Stateful filter: hysteresis + debounce on top of the stateless map. */
/* ------------------------------------------------------------------ */

/** Zone is left only after the cursor is this far back toward the centre. */
export const GAMEPLAY_ZONE_EXIT_LEFT = 0.4;
export const GAMEPLAY_ZONE_EXIT_RIGHT = 0.6;
/** Pinch engages below GAMEPLAY_PINCH_THRESHOLD and releases above this ratio. */
export const GAMEPLAY_PINCH_RELEASE = 0.5;
/** Consecutive tracked frames needed before ANY input is asserted after (re)acquiring the hand. */
export const GAMEPLAY_REACQUIRE_FRAMES = 3;
/** Consecutive pinched frames needed to engage a pinch (rejects 1-frame flicker). */
export const GAMEPLAY_PINCH_CONFIRM_FRAMES = 2;

export interface GameplayGestureFilterOptions {
  /**
   * PROVISIONAL (not product-final): treat a held pinch as "jump" (gameplay phase only).
   * Leave false while placing, where pinch means "grab the object".
   */
  enableJump?: boolean;
}

const NEUTRAL_FRAME: GameplayGestureFrame = {
  tracked: false,
  cursor: null,
  pinched: false,
  input: { left: false, right: false, jump: false },
};

/**
 * Per-frame filter used by GameplayHandDriver:
 * - tracking loss is IMMEDIATE neutral (never keep walking on a stale hand);
 * - after (re)acquisition, input stays neutral for GAMEPLAY_REACQUIRE_FRAMES frames;
 * - left/right zones use hysteresis (enter at 0.35/0.65, leave at 0.40/0.60) so a
 *   hand resting on a boundary does not chatter;
 * - pinch has hysteresis (engage <0.42, release >0.50) + a 2-frame confirm;
 * - the reported cursor is 1-euro smoothed (placement drag); zones use the raw cursor.
 */
export class GameplayGestureFilter {
  private stableFrames = 0;
  private dir: "left" | "right" | null = null;
  private pinched = false;
  private pinchFrames = 0;
  private readonly smoother = new PointSmoother();

  constructor(private readonly options: GameplayGestureFilterOptions = {}) {}

  reset(): void {
    this.stableFrames = 0;
    this.dir = null;
    this.pinched = false;
    this.pinchFrames = 0;
    this.smoother.reset();
  }

  update(landmarks: Landmark[] | undefined, timestampMs?: number): GameplayGestureFrame {
    const raw = evaluateGameplayGesture(landmarks);
    if (!raw.tracked || !raw.cursor) {
      this.reset();
      return { ...NEUTRAL_FRAME, input: { ...NEUTRAL_FRAME.input } } as GameplayGestureFrame;
    }
    const cursor = this.smoother.smooth(raw.cursor, timestampMs);
    this.stableFrames++;
    if (this.stableFrames < GAMEPLAY_REACQUIRE_FRAMES) {
      return { tracked: true, cursor, pinched: false, input: { left: false, right: false, jump: false } };
    }

    // pinch with hysteresis + confirm
    const ratio = pinchRatioOf(landmarks!);
    if (this.pinched) {
      if (ratio > GAMEPLAY_PINCH_RELEASE) {
        this.pinched = false;
        this.pinchFrames = 0;
      }
    } else if (ratio < GAMEPLAY_PINCH_THRESHOLD) {
      this.pinchFrames++;
      if (this.pinchFrames >= GAMEPLAY_PINCH_CONFIRM_FRAMES) this.pinched = true;
    } else {
      this.pinchFrames = 0;
    }

    // zone with hysteresis
    const x = raw.cursor.x;
    if (this.dir === "left") {
      if (x > GAMEPLAY_ZONE_EXIT_LEFT) this.dir = null;
    } else if (this.dir === "right") {
      if (x < GAMEPLAY_ZONE_EXIT_RIGHT) this.dir = null;
    }
    if (this.dir === null) {
      if (x < GAMEPLAY_LEFT_ZONE) this.dir = "left";
      else if (x > GAMEPLAY_RIGHT_ZONE) this.dir = "right";
    }

    return {
      tracked: true,
      cursor,
      pinched: this.pinched,
      input: {
        left: this.dir === "left",
        right: this.dir === "right",
        jump: Boolean(this.options.enableJump) && this.pinched,
      },
    };
  }
}

function pinchRatioOf(landmarks: Landmark[]): number {
  const f = evaluateGesture(landmarks);
  return f.state === "tracking" ? f.pinchRatio : 1;
}
