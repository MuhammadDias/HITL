import { describe, expect, it } from "vitest";
import { HandTrackingSession } from "@/src/input/hand-tracking-session";
import { OneEuroFilter } from "@/src/input/smoothing";
import { StrokeStore } from "@/src/input/types";
import { normalizeStrokes } from "@/src/input/normalize";
import { strokesToDrawingInput } from "@/src/input/pointer-input";
import { drawStroke } from "@/src/input";

describe("input quality guards", () => {
  it("smooths small landmark jitter with the Illustrator-tuned 1€ defaults", () => {
    const filter = new OneEuroFilter({ minCutoff: 0.7, beta: 0.02, dCutoff: 1 });
    filter.filter({ x: 0.5, y: 0.5 }, 0);
    const filtered = filter.filter({ x: 0.54, y: 0.5 }, 16);
    expect(filtered.x).toBeGreaterThan(0.5);
    expect(filtered.x).toBeLessThan(0.54);
  });

  it("decimates points closer than four CSS pixels when a driver supplies that threshold", () => {
    const store = new StrokeStore();
    store.beginStroke(0);
    store.addPoint({ x: 10, y: 10 }, 4);
    store.addPoint({ x: 13.9, y: 10 }, 4);
    store.addPoint({ x: 14, y: 10 }, 4);
    store.endStroke(100);
    expect(store.getStrokes().completed[0]).toHaveLength(2);
  });

  it("preserves a close point that forms a sharp corner", () => {
    const store = new StrokeStore();
    store.beginStroke(0);
    store.addPoint({ x: 0, y: 0 }, 4);
    store.addPoint({ x: 5, y: 0 }, 4);
    store.addPoint({ x: 5, y: 3 }, 4);

    expect(store.getStrokes().active).toMatchObject([
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 5, y: 3 },
    ]);
  });

  it("eases calligraphic width and opacity instead of stepping between samples", () => {
    const store = new StrokeStore({ smoothInk: true });
    store.beginStroke(0);
    store.addPoint({ x: 0, y: 0, width: 12, opacity: 1 }, 0);
    store.addPoint({ x: 10, y: 0, width: 2, opacity: 0.45 }, 0);

    const tapered = store.getStrokes().active?.[1];
    expect(tapered?.width).toBeGreaterThan(2);
    expect(tapered?.width).toBeLessThan(12);
    expect(tapered?.opacity).toBeGreaterThan(0.45);
    expect(tapered?.opacity).toBeLessThan(1);
  });

  it("keeps a complete hand skeleton when some landmarks report low visibility", () => {
    const session = new HandTrackingSession();
    let state = "lost";
    session.subscribeFrame((frame) => { state = frame.gesture.state; });
    const landmarks = Array.from({ length: 21 }, (_, index) => ({
      x: index === 4 ? 0.48 : 0.5,
      y: index === 0 ? 0.8 : index === 9 ? 0.6 : 0.4,
      visibility: index === 16 ? 0.1 : undefined,
    }));

    session.feedLandmarksForTest(landmarks, 0);

    expect(state).toBe("drawing");
  });

  it("keeps normalized width and opacity so downstream exports retain ink geometry", () => {
    const input = normalizeStrokes([[{ x: 0, y: 0, width: 4, opacity: 1 }, { x: 100, y: 0, width: 12, opacity: 0.4 }]]);
    expect(input.strokes[0]?.[0]?.width).toBeCloseTo(0.04);
    expect(input.strokes[0]?.[1]?.width).toBeCloseTo(0.12);
    expect(input.strokes[0]?.[1]?.opacity).toBeCloseTo(0.4);
  });

  it("converts CSS ink widths to backing pixels before DPR-normalized export", () => {
    const store = new StrokeStore();
    store.beginStroke(0);
    store.addPoint({ x: 0, y: 0, width: 4, opacity: 1 }, 0);
    store.addPoint({ x: 200, y: 0, width: 4, opacity: 1 }, 0);
    store.endStroke(100);

    expect(strokesToDrawingInput(store, 2).strokes[0]?.[0]?.width).toBeCloseTo(0.04);
  });

  it("uses a midpoint quadratic curve for a bend instead of a degenerate straight segment", () => {
    const curves: number[][] = [];
    const lines: number[][] = [];
    const context = {
      beginPath() {}, moveTo() {}, stroke() {},
      quadraticCurveTo: (...values: number[]) => curves.push(values),
      lineTo: (...values: number[]) => lines.push(values),
    } as unknown as CanvasRenderingContext2D;

    drawStroke(context, [
      { x: 0, y: 0, width: 4 },
      { x: 10, y: 10, width: 8, opacity: 0.8 },
      { x: 20, y: 0, width: 12, opacity: 0.5 },
    ], 1);

    expect(curves).toEqual([[10, 10, 15, 5], [20, 0, 20, 0]]);
    expect(lines).toEqual([]);
  });
});

  it("rescales stored backing-canvas geometry while preserving CSS ink width", () => {
    const store = new StrokeStore();
    store.beginStroke(0);
    store.addPoint({ x: 10, y: 20, width: 6 }, 0);
    store.addPoint({ x: 30, y: 40, width: 8 }, 0);
    store.scalePoints(2, 1.5);
    const stroke = store.getStrokes().active!;
    expect(stroke).toMatchObject([{ x: 20, y: 30, width: 6 }, { x: 60, y: 60, width: 8 }]);
  });
