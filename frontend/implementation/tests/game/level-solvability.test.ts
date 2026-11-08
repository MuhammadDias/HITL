import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { buildWorld, runPlan, solve } from "./level-reachability";
import { getStageGeometry } from "../../src/game/stage-geometry";
import { integratedPlacementAllowed } from "../../src/game/kaplay-runtime";

const plans = JSON.parse(readFileSync(new URL("../../e2e/lib/level-plans.json", import.meta.url), "utf8"));
const size = plans.objectSize as { w: number; h: number };

describe("level solvability (kinematic model; browser E2E is the authority)", () => {
  for (const stage of [1, 2, 3] as const) {
    it(`L${stage}: documented student plan reaches the goal with legal placements`, () => {
      const g = getStageGeometry(stage);
      const placed: Array<{ id: string; label: string; behavior: "solid"; drawingInput: null; x: number; y: number; w: number; h: number }> = [];
      for (const [i, c] of plans[String(stage)].cycles.entries()) {
        const rect = { x: c.x, y: c.y, w: size.w, h: size.h };
        expect(integratedPlacementAllowed(rect, g, placed), `cycle ${i + 1} placement legal`).toBe(true);
        placed.push({ id: `c${i}`, label: c.label, behavior: "solid", drawingInput: null, ...rect });
      }
      const w = buildWorld(stage, placed.map(p => ({ x: p.x, y: p.y, w: p.w, h: p.h, behavior: "solid" as const })));
      const r = runPlan(w, plans[String(stage)].steps);
      expect(r.outcome, r.log.join("\n")).toBe("goal");
    });
  }
  it("L1/L2/L3 are NOT solvable without a placed object (the object matters)", () => {
    for (const stage of [1, 2, 3] as const) expect(solve(buildWorld(stage)).solvable).toBe(false);
  });
  it("L3: a danger-behaviour object on the route fails the plan (hazard is real)", () => {
    const c = plans["3"].cycles[0];
    const w = buildWorld(3, [{ x: c.x, y: c.y, w: size.w, h: size.h, behavior: "danger" }]);
    expect(runPlan(w, plans["3"].steps).outcome).toBe("dead");
  });
});
