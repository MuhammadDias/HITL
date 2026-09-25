import { describe, expect, it } from "vitest";
import type { DrawingInput, LevelContext, ObjectBehavior } from "@/src/domain/types";
import { GROUND_Y, WorldSimulation, gestureAxis } from "@/src/game/world-simulation";

const DRAWING: DrawingInput = {
  strokes: [[{ x: 0.15, y: 0.2, width: 0.05, opacity: 0.9 }, { x: 0.8, y: 0.7, width: 0.1, opacity: 0.55 }]],
  hasInk: true,
  aspectRatio: 1.3,
};

function level(stage: 1 | 2 | 3, goalX = stage === 2 ? 900 : 700): LevelContext {
  return {
    levelId: `test-${stage}`,
    stage,
    cyclesRequired: 1,
    behaviorMap: {},
    vocabulary: [],
    scene: { groundEndX: 340, gapStartX: 340, gapWidth: 150, goalX },
  };
}
function creation(behavior: ObjectBehavior) { return { drawing: DRAWING, label: "bridge", behavior }; }
function advance(simulation: WorldSimulation, seconds: number, controls: { axis: number; jump?: boolean }) {
  let remaining = seconds;
  let jump = controls.jump ?? false;
  while (remaining > 0 && !simulation.outcome) {
    const dt = Math.min(0.02, remaining);
    simulation.step(dt, { axis: controls.axis, jump });
    jump = false;
    remaining -= dt;
  }
}
function walkTo(simulation: WorldSimulation, x: number) {
  while (simulation.x < x && !simulation.outcome) simulation.step(0.02, { axis: 1, jump: false });
}

describe("WorldSimulation progression", () => {
  it("L1 solid creation is crossable and retains the exact DrawingInput", () => {
    const simulation = new WorldSimulation(level(1), creation("solid"));
    advance(simulation, 4, { axis: 1 });

    expect(simulation.outcome).toBe("success");
    expect(simulation.creation?.drawing).toBe(DRAWING);
    expect(simulation.platforms.some((platform) => platform.kind === "drawing")).toBe(true);
  });

  it("without a creation the gap blocks walking and cannot complete", () => {
    const simulation = new WorldSimulation(level(1), null);
    advance(simulation, 6, { axis: 1 });

    expect(simulation.x).toBeLessThanOrEqual(325);
    expect(simulation.outcome).not.toBe("success");
  });

  it.each<ObjectBehavior>(["danger", "unresolved"])("L1 %s creation fails through the actual walk simulation", (behavior) => {
    const simulation = new WorldSimulation(level(1), creation(behavior));
    advance(simulation, 4, { axis: 1 });
    expect(simulation.outcome).toBe("fail");
  });

  it("L2 cannot finish by walking, then requires two controlled jumps onto its steps", () => {
    const walkingOnly = new WorldSimulation(level(2), creation("solid"));
    advance(walkingOnly, 5, { axis: 1 });
    expect(walkingOnly.outcome).not.toBe("success");
    expect(walkingOnly.y).toBe(GROUND_Y);

    const simulation = new WorldSimulation(level(2), creation("solid"));
    walkTo(simulation, 620);
    advance(simulation, 0.35, { axis: 1, jump: true });
    advance(simulation, 0.4, { axis: 0 });
    expect(simulation.grounded).toBe(true);
    expect(simulation.y).toBe(GROUND_Y - 33);

    advance(simulation, 0.35, { axis: 1, jump: true });
    advance(simulation, 0.4, { axis: 0 });
    expect(simulation.grounded).toBe(true);
    expect(simulation.y).toBe(GROUND_Y - 66);

    advance(simulation, 1, { axis: 1 });
    expect(simulation.outcome).toBe("success");
  });

  it("L3 moving eraser fails a ground walk but deliberate jump controls can clear it", () => {
    const hit = new WorldSimulation(level(3, 820), creation("solid"));
    advance(hit, 4, { axis: 1 });
    expect(hit.outcome).toBe("fail");

    const jumpClear = new WorldSimulation(level(3, 820), creation("solid"));
    walkTo(jumpClear, 545);
    advance(jumpClear, 0.9, { axis: 1, jump: true });
    advance(jumpClear, 2, { axis: 1 });
    expect(jumpClear.outcome).toBe("success");
  });
});

describe("gestureAxis", () => {
  it("uses a centre dead-zone and returns neutral on lost or invalid tracking", () => {
    expect(gestureAxis(0.4, true)).toBe(0);
    expect(gestureAxis(0.5, true)).toBe(0);
    expect(gestureAxis(0.6, true)).toBe(0);
    expect(gestureAxis(0.2, true)).toBe(-1);
    expect(gestureAxis(0.8, true)).toBe(1);
    expect(gestureAxis(0.8, false)).toBe(0);
    expect(gestureAxis(Number.NaN, true)).toBe(0);
  });
});
