import { describe, expect, it } from "vitest";
import { generateSketchSvg } from "../../src/game/sketch-renderer";

function pathBox(svg: string) {
  const pts = [...svg.matchAll(/[ML] ([\d.]+) ([\d.]+)/g)].map(m => [Number(m[1]), Number(m[2])] as const);
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  return { w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys), minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}

describe("student sketch fidelity in the collider-sized sprite", () => {
  const square = { hasInk: true, aspectRatio: 1, strokes: [[{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }, { x: 0, y: 0 }]] };
  it("keeps the drawing's proportions in the wide 131x19.6 object box (no 6.7x squash)", () => {
    const svg = generateSketchSvg(square, { width: 130.6, height: 19.6, behavior: "solid" });
    const b = pathBox(svg);
    expect(b.w / b.h).toBeCloseTo(1, 1);
    expect(b.minX).toBeGreaterThanOrEqual(0); expect(b.maxX).toBeLessThanOrEqual(131);
    expect(b.minY).toBeGreaterThanOrEqual(0); expect(b.maxY).toBeLessThanOrEqual(20);
  });
  it("is centred and supersampled via pixelScale without changing the viewBox", () => {
    const svg = generateSketchSvg(square, { width: 130, height: 20, behavior: "solid", pixelScale: 4 });
    expect(svg).toContain('width="520" height="80" viewBox="0 0 130 20"');
    const b = pathBox(svg);
    expect((b.minX + b.maxX) / 2).toBeCloseTo(65, 0);
  });
  it("does not explode on a single dot or a perfectly straight stroke", () => {
    const dot = generateSketchSvg({ hasInk: true, aspectRatio: 1, strokes: [[{ x: 0.5, y: 0.5 }]] }, { width: 130, height: 20, behavior: "solid" });
    expect(dot).toContain("<circle");
    const line = generateSketchSvg({ hasInk: true, aspectRatio: 9, strokes: [[{ x: 0, y: 0.5 }, { x: 1, y: 0.5 }]] }, { width: 130, height: 20, behavior: "solid" });
    const b = pathBox(line);
    expect(b.maxX).toBeLessThanOrEqual(131);
  });
});
