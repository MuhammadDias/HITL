import { describe, expect, it } from "vitest";
import { PointSmoother } from "@/src/input/smoothing";
import { evaluateGesture, indexTipNormalized, isPinched, mapToCanvas } from "@/src/input/hand-gesture";
import type { Landmark } from "@/src/input/types";

describe("PointSmoother (TASK 05)", () => {
  it("starts at first point then converges toward target", () => {
    const s = new PointSmoother(0.5);
    expect(s.smooth({ x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
    const a = s.smooth({ x: 10, y: 10 });
    expect(a.x).toBeCloseTo(5);
    const b = s.smooth({ x: 10, y: 10 });
    expect(b.x).toBeGreaterThan(a.x);
    expect(b.x).toBeLessThanOrEqual(10);
  });

  it("reset returns to snap behavior", () => {
    const s = new PointSmoother(0.2);
    s.smooth({ x: 0, y: 0 });
    s.reset();
    expect(s.smooth({ x: 7, y: 8 })).toEqual({ x: 7, y: 8 });
  });
});

/** Minimal right-hand pose: wrist, thumb tip, index tip, middle MCP at end. */
function hand(overrides?: Partial<Record<"thumb" | "index" | "wrist" | "mcp", Landmark>>): Landmark[] {
  const base: Landmark[] = new Array(21).fill(null).map(() => ({ x: 0.5, y: 0.5 }));
  const o = overrides ?? {};
  base[0] = o.wrist ?? { x: 0.5, y: 0.9 };
  base[4] = o.thumb ?? { x: 0.3, y: 0.55 };
  base[8] = o.index ?? { x: 0.5, y: 0.5 };
  base[9] = o.mcp ?? { x: 0.5, y: 0.7 };
  return base;
}

describe("hand-gesture mapping (TASK 05 provisional gesture)", () => {
  it("mirrors x for the camera preview frame and clamps to [0,1]", () => {
    const tip = indexTipNormalized(hand({ index: { x: 0.25, y: 1.4 } }));
    expect(tip.x).toBeCloseTo(0.75);
    expect(tip.y).toBeLessThanOrEqual(1);
  });

  it("mapToCanvas clamps into pixel bounds", () => {
    const p = mapToCanvas({ x: -0.3, y: 2 }, 480, 360);
    expect(p).toEqual({ x: 0, y: 360 });
  });

  it("pinch true when thumb-index close relative to hand span", () => {
    expect(isPinched(hand({ thumb: { x: 0.49, y: 0.52 } }))).toBe(true);
  });

  it("pinch false when fingers apart", () => {
    expect(isPinched(hand())).toBe(false);
  });

  it("evaluateGesture reports lost for missing/short landmarks", () => {
    expect(evaluateGesture(undefined)).toEqual({ state: "lost" });
    expect(evaluateGesture([{ x: 0, y: 0 }])).toEqual({ state: "lost" });
  });

  it("evaluateGesture tracks cursor + pinch when landmarks present", () => {
    const f = evaluateGesture(hand());
    expect(f.state).toBe("tracking");
    if (f.state === "tracking") {
      expect(f.pinched).toBe(false);
      expect(f.cursor.x).toBeGreaterThanOrEqual(0);
      expect(f.cursor.y).toBeGreaterThanOrEqual(0);
      expect(f.cursorState).toBe("hover");
    }
  });

  it("evaluateGesture transitions cursorState through hover -> near -> drawing", () => {
    // Apart -> hover
    const fHover = evaluateGesture(hand({ thumb: { x: 0.2, y: 0.55 } }));
    expect(fHover.state).toBe("tracking");
    if (fHover.state === "tracking") {
      expect(fHover.cursorState).toBe("hover");
      expect(fHover.pinched).toBe(false);
    }

    // Closer but not yet pinched -> near
    const fNear = evaluateGesture(hand({ thumb: { x: 0.4, y: 0.52 } }));
    expect(fNear.state).toBe("tracking");
    if (fNear.state === "tracking") {
      expect(fNear.cursorState).toBe("near");
      expect(fNear.pinched).toBe(false);
    }

    // Pinched -> drawing
    const fDrawing = evaluateGesture(hand({ thumb: { x: 0.49, y: 0.51 } }));
    expect(fDrawing.state).toBe("tracking");
    if (fDrawing.state === "tracking") {
      expect(fDrawing.cursorState).toBe("drawing");
      expect(fDrawing.pinched).toBe(true);
    }
  });
});
