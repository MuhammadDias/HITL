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

import { isPinched, indexTipNormalized } from "./hand-gesture";
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
