import { describe, expect, it } from "vitest";
import { getStageGeometry } from "@/src/game/stage-geometry";
import { integratedPlacementAllowed } from "@/src/game/kaplay-runtime";
import { LEVELS } from "@/src/domain/levels";
import { FlowController } from "@/src/app/state-machine";
import { MockPredictionProvider } from "@/src/prediction/mock-prediction-provider";
import { resolveBehavior } from "@/src/domain/behavior-resolver";
import type { DrawingInput } from "@/src/domain/types";

const MOCK_STROKE: DrawingInput = {
  strokes: [[{ x: 0.1, y: 0.5 }, { x: 0.9, y: 0.5 }]],
  hasInk: true,
  aspectRatio: 1,
};

describe("three-level puzzle geometry & solvability verification", () => {
  it("Level 1 (Foundation): gap width requires solid object to cross", () => {
    const l1 = LEVELS[0]!;
    expect(l1.stage).toBe(1);
    const g = getStageGeometry(1);

    expect(g.platforms.length).toBeGreaterThanOrEqual(2);
    expect(g.spawn.x).toBeLessThan(200);
    expect(g.goal.x).toBeGreaterThan(600);

    expect(resolveBehavior("papan", l1).behavior).toBe("solid");
    expect(resolveBehavior("balok", l1).behavior).toBe("solid");
    expect(resolveBehavior("tangga", l1).behavior).toBe("solid");
    expect(resolveBehavior("batu", l1).behavior).toBe("danger");
  });

  it("Level 2 (Ambiguity/Vertical): requires height positioning to reach elevated roof goal", () => {
    const l2 = LEVELS[1]!;
    expect(l2.stage).toBe(2);
    const g = getStageGeometry(2);

    expect(g.spawn.y).toBeGreaterThan(g.goal.y + 150);
    expect(g.goal.y).toBeLessThan(120);

    // Valid open-air positioning in Level 2
    const stepPlank = {
      id: "step-1",
      label: "balok",
      behavior: "solid" as const,
      drawingInput: null,
      x: 180,
      y: 70,
      w: g.object.w,
      h: g.object.h,
    };
    expect(integratedPlacementAllowed(stepPlank, g, [])).toBe(true);

    expect(resolveBehavior("papan", l2).behavior).toBe("solid");
    expect(resolveBehavior("balok", l2).behavior).toBe("solid");
    expect(resolveBehavior("tangga", l2).behavior).toBe("solid");
    expect(resolveBehavior("duri", l2).behavior).toBe("danger");
  });

  it("Level 3 (Critical Hazard): spikes on ground, context-aware mapping maps tali to danger", () => {
    const l3 = LEVELS[2]!;
    expect(l3.stage).toBe(3);
    const g = getStageGeometry(3);

    expect(g.hazards.length).toBeGreaterThan(0);
    expect(g.hazards[0]!.id).toContain("spike");

    expect(resolveBehavior("tali", l3).behavior).toBe("danger");
    expect(resolveBehavior("papan", l3).behavior).toBe("solid");
    expect(resolveBehavior("tangga", l3).behavior).toBe("solid");
  });
});

describe("sequential three-level journey without softlock", () => {
  it("transitions cleanly: L1 -> complete -> L2 -> complete -> L3 -> complete (final summary)", async () => {
    const provider = new MockPredictionProvider({
      vocabulary: ["papan", "balok", "tangga", "batu", "tali", "duri"],
      stage: 1,
      latencyMs: 0,
    });
    const controller = new FlowController({ provider, goalCompletesLevel: true });

    // Step 1: Start Level 1
    controller.enterLevel(LEVELS[0]!);
    expect(controller.getSnapshot().phase).toBe("drawing");
    expect(controller.getSnapshot().levelId).toBe("stage-1-foundation");

    // Draw -> Predict -> Accept
    await controller.submitDrawing(MOCK_STROKE);
    expect(controller.getSnapshot().phase).toBe("evaluating");
    controller.decideAccept();
    expect(controller.getSnapshot().phase).toBe("falling");
    controller.completeFall();
    controller.commitPlacement();
    expect(controller.getSnapshot().phase).toBe("gameplay");

    // Win L1
    controller.reportGameplayOutcome("success");
    expect(controller.getSnapshot().phase).toBe("complete");

    // Step 2: Next Level -> Level 2
    controller.exitToLevelEntry();
    expect(controller.getSnapshot().phase).toBe("level-entry");
    controller.enterLevel(LEVELS[1]!);
    expect(controller.getSnapshot().phase).toBe("drawing");
    expect(controller.getSnapshot().levelId).toBe("stage-2-ambiguity");

    // Draw -> Predict -> Correct (Pick candidate rank 2)
    await controller.submitDrawing(MOCK_STROKE);
    expect(controller.getSnapshot().phase).toBe("evaluating");
    controller.decideCorrect(2);
    expect(controller.getSnapshot().phase).toBe("falling");
    controller.completeFall();
    controller.commitPlacement();
    expect(controller.getSnapshot().phase).toBe("gameplay");

    // Win L2
    controller.reportGameplayOutcome("success");
    expect(controller.getSnapshot().phase).toBe("complete");

    // Step 3: Next Level -> Level 3
    controller.exitToLevelEntry();
    expect(controller.getSnapshot().phase).toBe("level-entry");
    controller.enterLevel(LEVELS[2]!);
    expect(controller.getSnapshot().phase).toBe("drawing");
    expect(controller.getSnapshot().levelId).toBe("stage-3-validation");

    // Draw -> Predict -> Override to tangga
    await controller.submitDrawing(MOCK_STROKE);
    expect(controller.getSnapshot().phase).toBe("evaluating");
    controller.decideOverride("jembatan");
    expect(controller.getSnapshot().phase).toBe("falling");
    controller.completeFall();
    controller.commitPlacement();
    expect(controller.getSnapshot().phase).toBe("gameplay");

    // Win L3 -> Final Summary
    controller.reportGameplayOutcome("success");
    expect(controller.getSnapshot().phase).toBe("complete");
    expect(controller.getSnapshot().levelId).toBe("stage-3-validation");
  });
});
