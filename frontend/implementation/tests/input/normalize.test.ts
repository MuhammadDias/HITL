import { describe, expect, it } from "vitest";
import { normalizeStrokes } from "@/src/input/normalize";

describe("normalizeStrokes (FR-01)", () => {
  it("empty input has no ink", () => {
    expect(normalizeStrokes([]).hasInk).toBe(false);
  });

  it("drops sub-minimum jitter strokes", () => {
    expect(normalizeStrokes([[{ x: 10, y: 10 }]]).hasInk).toBe(false);
  });

  it("bbox-normalizes into [0,1] with letterboxing", () => {
    const out = normalizeStrokes([
      [{ x: 100, y: 50 }, { x: 180, y: 50 }, { x: 180, y: 90 }],
    ]);
    expect(out.hasInk).toBe(true);
    for (const stroke of out.strokes) {
      for (const p of stroke) {
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.x).toBeLessThanOrEqual(1);
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeLessThanOrEqual(1);
      }
    }
    const first = out.strokes[0]!;
    expect(Math.max(...first.map((p) => p.x))).toBeCloseTo(1, 2);
    expect(Math.max(...first.map((p) => p.y))).toBeLessThan(1);
  });

  it("deterministic for identical raw strokes", () => {
    const raw = [[{ x: 5, y: 5 }, { x: 60, y: 40 }]];
    expect(normalizeStrokes(raw)).toEqual(normalizeStrokes(raw.map((s) => [...s])));
  });
});
