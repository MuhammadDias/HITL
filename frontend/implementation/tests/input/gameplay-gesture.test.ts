import { describe, expect, it } from "vitest";
import {
  evaluateGameplayGesture,
  cursorToGameplayInput,
  GAMEPLAY_LEFT_ZONE,
  GAMEPLAY_RIGHT_ZONE,
} from "@/src/input/gameplay-gesture";
import type { Landmark } from "@/src/input/types";

/** Minimal right-hand pose helper. */
function hand(overrides?: Partial<Record<"thumb" | "index" | "wrist" | "mcp", Landmark>>): Landmark[] {
  const base: Landmark[] = new Array(21).fill(null).map(() => ({ x: 0.5, y: 0.5 }));
  const o = overrides ?? {};
  base[0] = o.wrist ?? { x: 0.5, y: 0.9 };
  base[4] = o.thumb ?? { x: 0.3, y: 0.55 };
  base[8] = o.index ?? { x: 0.5, y: 0.5 };
  base[9] = o.mcp ?? { x: 0.5, y: 0.7 };
  return base;
}

describe("gameplay-gesture (pure gesture adapter)", () => {
  describe("tracking loss handling", () => {
    it("returns untracked neutral state when landmarks are undefined", () => {
      const frame = evaluateGameplayGesture(undefined);
      expect(frame.tracked).toBe(false);
      expect(frame.cursor).toBeNull();
      expect(frame.pinched).toBe(false);
      expect(frame.input).toEqual({ left: false, right: false, jump: false });
    });

    it("returns untracked neutral state when landmarks array is incomplete", () => {
      const frame = evaluateGameplayGesture([{ x: 0, y: 0 }]);
      expect(frame.tracked).toBe(false);
      expect(frame.cursor).toBeNull();
      expect(frame.pinched).toBe(false);
      expect(frame.input).toEqual({ left: false, right: false, jump: false });
    });
  });

  describe("mirroring and index tip mapping", () => {
    it("mirrors index tip x coordinate exactly once: (1 - tip.x)", () => {
      // In camera frame, index tip is at x=0.2 (left side of camera)
      // When mirrored, user sees it on the right side: 1 - 0.2 = 0.8
      const frame = evaluateGameplayGesture(hand({ index: { x: 0.2, y: 0.5 } }));
      expect(frame.tracked).toBe(true);
      expect(frame.cursor).not.toBeNull();
      expect(frame.cursor!.x).toBeCloseTo(0.8);
      expect(frame.cursor!.y).toBeCloseTo(0.5);
    });

    it("clamps cursor coordinates to [0, 1]", () => {
      const frame = evaluateGameplayGesture(hand({ index: { x: -0.2, y: 1.5 } }));
      expect(frame.tracked).toBe(true);
      expect(frame.cursor!.x).toBeLessThanOrEqual(1);
      expect(frame.cursor!.x).toBeGreaterThanOrEqual(0);
      expect(frame.cursor!.y).toBeLessThanOrEqual(1);
      expect(frame.cursor!.y).toBeGreaterThanOrEqual(0);
    });
  });

  describe("gameplay horizontal movement zones", () => {
    it("left zone triggers left movement (< 0.35)", () => {
      // Mirrored x < 0.35 means raw camera index.x > 0.65 (e.g. 0.8 => mirrored 0.2)
      const frame = evaluateGameplayGesture(hand({ index: { x: 0.8, y: 0.5 } }));
      expect(frame.tracked).toBe(true);
      expect(frame.cursor!.x).toBeCloseTo(0.2);
      expect(frame.input.left).toBe(true);
      expect(frame.input.right).toBe(false);
      expect(frame.input.jump).toBe(false);
    });

    it("right zone triggers right movement (> 0.65)", () => {
      // Mirrored x > 0.65 means raw camera index.x < 0.35 (e.g. 0.2 => mirrored 0.8)
      const frame = evaluateGameplayGesture(hand({ index: { x: 0.2, y: 0.5 } }));
      expect(frame.tracked).toBe(true);
      expect(frame.cursor!.x).toBeCloseTo(0.8);
      expect(frame.input.left).toBe(false);
      expect(frame.input.right).toBe(true);
      expect(frame.input.jump).toBe(false);
    });

    it("center zone neutral stop (between 0.35 and 0.65)", () => {
      // Mirrored x at center: raw camera index.x = 0.5 => mirrored 0.5
      const frame = evaluateGameplayGesture(hand({ index: { x: 0.5, y: 0.5 } }));
      expect(frame.tracked).toBe(true);
      expect(frame.cursor!.x).toBeCloseTo(0.5);
      expect(frame.input.left).toBe(false);
      expect(frame.input.right).toBe(false);
      expect(frame.input.jump).toBe(false);
    });
  });

  describe("pinch detection for drag/grab", () => {
    it("detects pinch when thumb and index tips are close relative to wrist-mcp span", () => {
      const frame = evaluateGameplayGesture(
        hand({
          thumb: { x: 0.49, y: 0.51 },
          index: { x: 0.5, y: 0.5 },
        }),
      );
      expect(frame.tracked).toBe(true);
      expect(frame.pinched).toBe(true);
    });

    it("detects non-pinch when fingers are apart", () => {
      const frame = evaluateGameplayGesture(
        hand({
          thumb: { x: 0.2, y: 0.55 },
          index: { x: 0.5, y: 0.5 },
        }),
      );
      expect(frame.tracked).toBe(true);
      expect(frame.pinched).toBe(false);
    });
  });

  describe("cursorToGameplayInput helper", () => {
    it("handles boundary values correctly", () => {
      expect(cursorToGameplayInput(0.34, 0.5, false)).toEqual({ left: true, right: false, jump: false });
      expect(cursorToGameplayInput(0.35, 0.5, false)).toEqual({ left: false, right: false, jump: false });
      expect(cursorToGameplayInput(0.5, 0.5, false)).toEqual({ left: false, right: false, jump: false });
      expect(cursorToGameplayInput(0.65, 0.5, false)).toEqual({ left: false, right: false, jump: false });
      expect(cursorToGameplayInput(0.66, 0.5, false)).toEqual({ left: false, right: true, jump: false });
    });
  });
});
