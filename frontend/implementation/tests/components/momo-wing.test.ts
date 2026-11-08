import { describe, expect, it } from "vitest";
import { WING_GEOMETRY, WING_MAX_SHIFT, wingPoint, wingTransform, type WingSide } from "@/src/components/momo/momo-wing";

const sides: WingSide[] = ["L", "R"];
const angles = [-32, -20, -7, 0, 9, 16, 32, 80, -80];

describe("Momo wing shear", () => {
  it.each(sides)("keeps the apex and the whole attach edge fixed (%s)", (side) => {
    const { a, b } = WING_GEOMETRY[side];
    for (const angle of angles) {
      for (const t of [0, 0.25, 0.5, 0.75, 1]) {
        const p: [number, number] = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
        const q = wingPoint(side, angle, p);
        expect(Math.hypot(q[0] - p[0], q[1] - p[1])).toBeLessThan(1e-9);
      }
    }
  });

  it.each(sides)("moves only the tip, up for negative and down for positive angle (%s)", (side) => {
    const { tip } = WING_GEOMETRY[side];
    const down = wingPoint(side, 32, tip);
    const up = wingPoint(side, -32, tip);
    expect(down[1]).toBeGreaterThan(tip[1]);
    expect(up[1]).toBeLessThan(tip[1]);
    expect(Math.hypot(down[0] - tip[0], down[1] - tip[1])).toBeCloseTo(WING_MAX_SHIFT, 5);
  });

  it("is the identity at rest and clamps extreme angles", () => {
    expect(wingTransform("L", 0)).toBe("matrix(1.00000000 0.00000000 0.00000000 1.00000000 0.00000000 0.00000000)");
    expect(wingTransform("R", 500)).toBe(wingTransform("R", 50));
    expect(wingTransform("R", -500)).toBe(wingTransform("R", -50));
  });
});
