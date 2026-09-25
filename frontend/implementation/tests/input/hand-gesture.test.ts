import { describe, expect, it } from "vitest";
import { OneEuroFilter, PointSmoother } from "@/src/input/smoothing";
import {
  HandGestureStateMachine,
  DEFAULT_GESTURE_THRESHOLDS,
  LANDMARK_INDEX,
  calculateNormalizedPinch,
  evaluateGesture,
  indexTipNormalized,
  isPinched,
  mapToCanvas,
} from "@/src/input/hand-gesture";
import { StrokeStore } from "@/src/input/types";
import type { Landmark } from "@/src/input/types";

describe("1€ Filter / OneEuroFilter & PointSmoother", () => {
  it("starts at first point and smoothly filters position", () => {
    const filter = new OneEuroFilter({ minCutoff: 1.0, beta: 0.008, dCutoff: 1.0 });
    const p0 = filter.filter({ x: 0, y: 0 }, 0);
    expect(p0).toEqual({ x: 0, y: 0 });

    const p1 = filter.filter({ x: 10, y: 10 }, 16.6); // frame 1 (~60fps)
    expect(p1.x).toBeGreaterThan(0);
    expect(p1.x).toBeLessThan(10);
    expect(p1.y).toBeGreaterThan(0);
    expect(p1.y).toBeLessThan(10);
  });

  it("adapts cutoff dynamically: fast movements experience lower lag than slow movements", () => {
    const slowFilter = new OneEuroFilter({ minCutoff: 1.0, beta: 0.008 });
    slowFilter.filter({ x: 0, y: 0 }, 0);
    const slowStep = slowFilter.filter({ x: 1, y: 0 }, 16.6); // delta = 1px (slow)
    const slowAlphaRatio = slowStep.x / 1;

    const fastFilter = new OneEuroFilter({ minCutoff: 1.0, beta: 0.008 });
    fastFilter.filter({ x: 0, y: 0 }, 0);
    const fastStep = fastFilter.filter({ x: 100, y: 0 }, 16.6); // delta = 100px (fast)
    const fastAlphaRatio = fastStep.x / 100;

    // Fast movement should have higher effective alpha (tracks faster with less lag)
    expect(fastAlphaRatio).toBeGreaterThan(slowAlphaRatio);
  });

  it("reset returns filter to snap behavior", () => {
    const s = new PointSmoother();
    s.smooth({ x: 0, y: 0 }, 0);
    s.smooth({ x: 5, y: 5 }, 16.6);
    s.reset();
    expect(s.smooth({ x: 100, y: 200 }, 100)).toEqual({ x: 100, y: 200 });
  });
});

/** Helper to generate a full 21-landmark hand skeleton. */
function createHandSkeleton(overrides?: Partial<Record<keyof typeof LANDMARK_INDEX, Landmark>>): Landmark[] {
  const base: Landmark[] = new Array(21).fill(null).map(() => ({ x: 0.5, y: 0.5 }));
  // Default rest pose: hand oriented upwards
  base[LANDMARK_INDEX.WRIST] = { x: 0.5, y: 0.9 };
  base[LANDMARK_INDEX.THUMB_CMC] = { x: 0.45, y: 0.8 };
  base[LANDMARK_INDEX.THUMB_MCP] = { x: 0.40, y: 0.7 };
  base[LANDMARK_INDEX.THUMB_IP] = { x: 0.35, y: 0.6 };
  base[LANDMARK_INDEX.THUMB_TIP] = { x: 0.30, y: 0.55 };

  base[LANDMARK_INDEX.INDEX_MCP] = { x: 0.48, y: 0.65 };
  base[LANDMARK_INDEX.INDEX_PIP] = { x: 0.48, y: 0.55 };
  base[LANDMARK_INDEX.INDEX_DIP] = { x: 0.49, y: 0.48 };
  base[LANDMARK_INDEX.INDEX_TIP] = { x: 0.50, y: 0.40 }; // extended (tip y < pip y)

  base[LANDMARK_INDEX.MIDDLE_MCP] = { x: 0.50, y: 0.65 };
  base[LANDMARK_INDEX.MIDDLE_PIP] = { x: 0.52, y: 0.55 };
  base[LANDMARK_INDEX.MIDDLE_DIP] = { x: 0.53, y: 0.48 };
  base[LANDMARK_INDEX.MIDDLE_TIP] = { x: 0.55, y: 0.40 };

  base[LANDMARK_INDEX.RING_MCP] = { x: 0.54, y: 0.67 };
  base[LANDMARK_INDEX.RING_PIP] = { x: 0.54, y: 0.60 };
  base[LANDMARK_INDEX.RING_DIP] = { x: 0.54, y: 0.64 };
  base[LANDMARK_INDEX.RING_TIP] = { x: 0.54, y: 0.68 }; // curled (tip y > pip y)

  base[LANDMARK_INDEX.PINKY_MCP] = { x: 0.58, y: 0.70 };
  base[LANDMARK_INDEX.PINKY_PIP] = { x: 0.58, y: 0.65 };
  base[LANDMARK_INDEX.PINKY_DIP] = { x: 0.58, y: 0.69 };
  base[LANDMARK_INDEX.PINKY_TIP] = { x: 0.58, y: 0.72 }; // curled (tip y > pip y)

  if (overrides) {
    for (const [key, value] of Object.entries(overrides)) {
      const idx = LANDMARK_INDEX[key as keyof typeof LANDMARK_INDEX];
      if (idx !== undefined && value) base[idx] = value;
    }
  }

  return base;
}

function rotateHand(hand: Landmark[], degrees: number, origin = { x: 0.5, y: 0.65 }): Landmark[] {
  const radians = degrees * Math.PI / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return hand.map((point) => {
    const x = point.x - origin.x;
    const y = point.y - origin.y;
    return { ...point, x: origin.x + x * cos - y * sin, y: origin.y + x * sin + y * cos };
  });
}

describe("Coordinate mapping & Landmark calculations", () => {
  it("mirrors x for the camera preview frame and clamps to [0,1]", () => {
    const tip = indexTipNormalized(createHandSkeleton({ INDEX_TIP: { x: 0.25, y: 1.4 } }));
    expect(tip.x).toBeCloseTo(0.75);
    expect(tip.y).toBeLessThanOrEqual(1.0);
  });

  it("mapToCanvas clamps into pixel bounds", () => {
    const p = mapToCanvas({ x: -0.3, y: 2 }, 480, 360);
    expect(p).toEqual({ x: 0, y: 360 });
  });

  it("normalizes pinch distance by palm span (Wrist L0 -> Middle MCP L9)", () => {
    const hand = createHandSkeleton({
      WRIST: { x: 0.5, y: 0.9 },
      MIDDLE_MCP: { x: 0.5, y: 0.65 }, // span = 0.25
      THUMB_TIP: { x: 0.5, y: 0.45 },
      INDEX_TIP: { x: 0.5, y: 0.40 },  // raw pinch = 0.05
    });
    const { normalizedPinch, palmSpan } = calculateNormalizedPinch(hand);
    expect(palmSpan).toBeCloseTo(0.25);
    expect(normalizedPinch).toBeCloseTo(0.05 / 0.25); // 0.20
    expect(isPinched(hand, 0.35)).toBe(true);
  });
});

describe("Pinch Hysteresis (Schmitt Trigger)", () => {
  it("uses the required close and open thresholds", () => {
    expect(DEFAULT_GESTURE_THRESHOLDS).toMatchObject({ pinchClose: 0.40, pinchOpen: 0.55 });
  });

  it("enters, holds, and exits at the default normalized thresholds", () => {
    const sm = new HandGestureStateMachine();
    const makeHand = (distance: number) => createHandSkeleton({
      WRIST: { x: 0.5, y: 0.9 },
      MIDDLE_MCP: { x: 0.5, y: 0.7 }, // span = 0.2
      THUMB_TIP: { x: 0.5 + distance * 0.2, y: 0.4 },
      INDEX_TIP: { x: 0.5, y: 0.4 },
    });

    expect(sm.evaluate(makeHand(0.41), 0).state).toBe("hover");
    expect(sm.evaluate(makeHand(0.40), 16).state).toBe("drawing");
    expect(sm.evaluate(makeHand(0.54), 32).state).toBe("drawing");
    expect(sm.evaluate(makeHand(0.55), 48).state).toBe("hover");
  });

  it("keeps identical pinch decisions after hand rotation", () => {
    const makeHand = (distance: number) => createHandSkeleton({
      WRIST: { x: 0.5, y: 0.9 },
      MIDDLE_MCP: { x: 0.5, y: 0.7 },
      THUMB_TIP: { x: 0.5 + distance * 0.2, y: 0.4 },
      INDEX_TIP: { x: 0.5, y: 0.4 },
    });
    const upright = new HandGestureStateMachine();
    const sideways = new HandGestureStateMachine();

    expect(upright.evaluate(makeHand(0.40), 0).pinched).toBe(true);
    expect(sideways.evaluate(rotateHand(makeHand(0.40), 90), 0).pinched).toBe(true);
    expect(upright.evaluate(makeHand(0.55), 16).pinched).toBe(false);
    expect(sideways.evaluate(rotateHand(makeHand(0.55), 90), 16).pinched).toBe(false);
  });

  it("maps the hysteresis range to a clean far-to-touch proximity ratio", () => {
    const sm = new HandGestureStateMachine();
    const makeHand = (distance: number) => createHandSkeleton({
      WRIST: { x: 0.5, y: 0.9 },
      MIDDLE_MCP: { x: 0.5, y: 0.7 },
      THUMB_TIP: { x: 0.5 + distance * 0.2, y: 0.4 },
      INDEX_TIP: { x: 0.5, y: 0.4 },
    });

    expect(sm.evaluate(makeHand(0.55), 0).proximityRatio).toBeCloseTo(0);
    expect(sm.evaluate(makeHand(0.475), 16).proximityRatio).toBeCloseTo(0.5);
    expect(sm.evaluate(makeHand(0.40), 32).proximityRatio).toBeCloseTo(1);
    expect(sm.evaluate(makeHand(0.10), 48).proximityRatio).toBe(1);
  });
});

describe("V-Sign Undo Gesture (Dwell 400ms)", () => {
  it("detects V-Sign pose and increases dwell progress up to 400ms trigger", () => {
    const sm = new HandGestureStateMachine({ undoDwellMs: 400 });
    const vSignHand = createHandSkeleton({
      WRIST: { x: 0.5, y: 0.9 }, MIDDLE_MCP: { x: 0.5, y: 0.7 },
      INDEX_PIP: { x: 0.46, y: 0.55 }, INDEX_TIP: { x: 0.46, y: 0.40 },
      MIDDLE_PIP: { x: 0.54, y: 0.55 }, MIDDLE_TIP: { x: 0.54, y: 0.40 },
      RING_PIP: { x: 0.52, y: 0.60 }, RING_TIP: { x: 0.52, y: 0.68 },
      PINKY_PIP: { x: 0.56, y: 0.65 }, PINKY_TIP: { x: 0.56, y: 0.72 },
      THUMB_TIP: { x: 0.30, y: 0.60 },
    });
    expect(sm.evaluate(vSignHand, 1000)).toMatchObject({ state: "undo-pending", undoProgress: 0 });
    expect(sm.evaluate(vSignHand, 1200)).toMatchObject({ state: "undo-pending", undoProgress: 0.5 });
    expect(sm.evaluate(vSignHand, 1400)).toMatchObject({ state: "undo-triggered", undoProgress: 1 });
    expect(sm.evaluate(vSignHand, 1500).state).toBe("undo-pending");
  });

  it("cancels dwell progress if V-Sign is broken before 400ms", () => {
    const sm = new HandGestureStateMachine({ undoDwellMs: 400 });
    const vSignHand = createHandSkeleton({
      INDEX_PIP: { x: 0.46, y: 0.55 }, INDEX_TIP: { x: 0.46, y: 0.40 },
      MIDDLE_PIP: { x: 0.54, y: 0.55 }, MIDDLE_TIP: { x: 0.54, y: 0.40 },
      RING_PIP: { x: 0.52, y: 0.60 }, RING_TIP: { x: 0.52, y: 0.68 },
      PINKY_PIP: { x: 0.56, y: 0.65 }, PINKY_TIP: { x: 0.56, y: 0.72 },
      THUMB_TIP: { x: 0.30, y: 0.60 },
    });
    sm.evaluate(vSignHand, 1000);
    expect(sm.evaluate(vSignHand, 1200).undoProgress).toBeCloseTo(0.5);
    const brokenHand = createHandSkeleton({
      MIDDLE_PIP: { x: 0.54, y: 0.55 }, MIDDLE_TIP: { x: 0.54, y: 0.65 }, THUMB_TIP: { x: 0.30, y: 0.60 },
    });
    expect(sm.evaluate(brokenHand, 1250)).toMatchObject({ state: "hover", undoProgress: 0 });
    expect(sm.evaluate(vSignHand, 1300)).toMatchObject({ state: "undo-pending", undoProgress: 0 });
  });
});

describe("Tracking loss & evaluateGesture helper", () => {
  it("evaluateGesture reports lost for missing or short landmark arrays", () => {
    expect(evaluateGesture(undefined).state).toBe("lost");
    expect(evaluateGesture([]).state).toBe("lost");
    expect(evaluateGesture([{ x: 0, y: 0 }]).state).toBe("lost");
  });
});

describe("StrokeStore (Debounce & Undo)", () => {
  it("discards accidental micro-tap strokes (<80ms AND <6px)", () => {
    const store = new StrokeStore({ minStrokeDurationMs: 80, minStrokeLengthPx: 6 });
    store.beginStroke(1000); store.addPoint({ x: 50, y: 50 }); store.addPoint({ x: 51, y: 51 }); store.endStroke(1030);
    expect(store.getStrokes().completed).toHaveLength(0);
    expect(store.hasInk()).toBe(false);
  });

  it("drops stationary held input so it cannot create a blot", () => {
    const store = new StrokeStore({ minStrokeDurationMs: 80, minStrokeLengthPx: 6 });
    store.beginStroke(1000); store.addPoint({ x: 50, y: 50 }); store.endStroke(1100);
    expect(store.getStrokes().completed).toHaveLength(0);
    expect(store.hasInk()).toBe(false);
  });

  it("keeps strokes with sufficient path length (>=6px) even if fast (<80ms)", () => {
    const store = new StrokeStore({ minStrokeDurationMs: 80, minStrokeLengthPx: 6 });
    store.beginStroke(1000); store.addPoint({ x: 50, y: 50 }); store.addPoint({ x: 70, y: 50 }); store.endStroke(1040);
    expect(store.getStrokes().completed).toHaveLength(1);
    expect(store.hasInk()).toBe(true);
  });

  it("undo removes the last completed stroke", () => {
    const store = new StrokeStore();
    store.beginStroke(1000); store.addPoint({ x: 10, y: 10 }); store.addPoint({ x: 30, y: 30 }); store.endStroke(1100);
    expect(store.undo()).toBe(true);
    expect(store.getStrokes().completed).toHaveLength(0);
    expect(store.hasInk()).toBe(false);
  });
});
