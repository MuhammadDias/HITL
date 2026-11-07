import { beforeEach, describe, expect, it } from "vitest";
import { FlowController, InvalidTransitionError } from "@/src/app/state-machine";
import { MockPredictionProvider } from "@/src/prediction/mock-prediction-provider";
import { LEVELS, getLevel } from "@/src/domain/levels";
import type { DrawingInput } from "@/src/domain/types";
import type { InteractionEvent } from "@/src/domain/events";

const INK: DrawingInput = {
  strokes: [[{ x: 0.1, y: 0.5 }, { x: 0.9, y: 0.4 }]],
  hasInk: true,
  aspectRatio: 1,
};
const EMPTY: DrawingInput = { strokes: [], hasInk: false, aspectRatio: 1 };

function recordingSink() {
  const events: InteractionEvent[] = [];
  return { events, sink: { emit: (e: InteractionEvent) => void events.push(e) } };
}

function makeFlow(stageId: string) {
  const level = getLevel(stageId)!;
  const rec = recordingSink();
  const provider = new MockPredictionProvider({
    vocabulary: ["papan", "batu", "tangga", "tali"],
    stage: level.stage,
    latencyMs: 0,
  });
  const flow = new FlowController({ provider, sink: rec.sink });
  return { flow, provider, level, events: rec.events };
}

let ctx: ReturnType<typeof makeFlow>;
describe("FlowController — PRD §13 vertical slice (TASK 02/03)", () => {
  beforeEach(() => {
    ctx = makeFlow("stage-1-foundation");
  });

  async function drawAndSubmit(): Promise<void> {
    ctx.flow.enterLevel(ctx.level);
    await ctx.flow.submitDrawing(INK);
  }

  it("AC-01/02/03/07 happy path accept → falling → placing → gameplay → complete (stage 1)", async () => {
    await drawAndSubmit();
    expect(ctx.flow.phase).toBe("evaluating");
    expect(ctx.flow.prediction?.candidates).toHaveLength(3);

    // Gameplay cannot be reported before a decision exists (AC-07).
    expect(() => ctx.flow.reportGameplayOutcome("success")).toThrow(InvalidTransitionError);

    ctx.flow.decideAccept();
    expect(ctx.flow.phase).toBe("falling");
    expect(ctx.flow.decision).toMatchObject({ type: "accept", sourceRank: 1 });
    expect(ctx.flow.behavior).toBe("solid");

    ctx.flow.completeFall();
    expect(ctx.flow.phase).toBe("placing");

    ctx.flow.commitPlacement();
    expect(ctx.flow.phase).toBe("gameplay");

    ctx.flow.reportGameplayOutcome("success");
    expect(ctx.flow.phase).toBe("complete");
    expect(ctx.flow.cyclesCompleted).toBe(1);
  });

  it("AC-04/05 correct resolves rank 2 and rank 3", async () => {
    for (const rank of [2, 3] as const) {
      const c = makeFlow("stage-2-ambiguity");
      c.flow.enterLevel(c.level);
      await c.flow.submitDrawing(INK);
      c.flow.decideCorrect(rank);
      expect(c.flow.decision).toMatchObject({ type: "correct", sourceRank: rank });
      expect(c.flow.phase).toBe("falling");
      c.flow.completeFall();
      expect(c.flow.phase).toBe("placing");
      c.flow.commitPlacement();
      expect(c.flow.phase).toBe("gameplay");
    }
  });

  it("AC-06 override valid label; invalid rejected without state change", async () => {
    await drawAndSubmit();
    const before = ctx.flow.getSnapshot();
    const top3 = ctx.flow.prediction!.candidates.map((c) => c.label);

    expect(() => ctx.flow.decideOverride(top3[0]!)).toThrow();
    expect(() => ctx.flow.decideOverride("   ")).toThrow();
    expect(ctx.flow.getSnapshot()).toEqual(before);

    const alt = ["papan", "batu", "tangga", "tali"].find((v) => !top3.includes(v))!;
    ctx.flow.decideOverride(alt);
    expect(ctx.flow.decision).toEqual({ type: "override", finalLabel: alt });
    expect(ctx.flow.phase).toBe("falling");
    ctx.flow.completeFall();
    ctx.flow.commitPlacement();
    expect(ctx.flow.phase).toBe("gameplay");
  });

  it("AC-08/FR-07 redraw resets cycle state but preserves level context", async () => {
    await drawAndSubmit();
    ctx.flow.requestRedraw("evaluation");
    expect(ctx.flow.phase).toBe("drawing");
    expect(ctx.flow.prediction).toBeNull();
    expect(ctx.flow.decision).toBeNull();
    expect(ctx.flow.level?.levelId).toBe("stage-1-foundation");
    expect(ctx.flow.cyclesCompleted).toBe(0);
  });

  it("FR-01/FR-15 empty drawing rejected before the provider", async () => {
    ctx.flow.enterLevel(ctx.level);
    await ctx.flow.submitDrawing(EMPTY);
    expect(ctx.flow.phase).toBe("drawing");
    expect(ctx.flow.feedback).toBe("empty-drawing");
  });

  it("AC-11 provider failure visible; retry recovers without restart", async () => {
    ctx.provider.setMode("fail");
    await drawAndSubmit();
    expect(ctx.flow.phase).toBe("prediction-error");
    expect(ctx.flow.errorDetail).toBe("provider-unavailable");

    ctx.provider.setMode("normal");
    await ctx.flow.retryPrediction();
    expect(ctx.flow.phase).toBe("evaluating");
    expect(ctx.flow.prediction).not.toBeNull();
  });

  it("malformed response lands in recoverable error state (TASK 13)", async () => {
    ctx.provider.setMode("malformed");
    await drawAndSubmit();
    expect(ctx.flow.phase).toBe("prediction-error");
    expect(ctx.flow.errorDetail).toBe("malformed-response");
    ctx.provider.setMode("normal");
    await ctx.flow.retryPrediction();
    expect(ctx.flow.phase).toBe("evaluating");
  });

  it("AC-10 danger fail returns to drawing with recovery", async () => {
    const c = makeFlow("stage-3-validation");
    c.flow.enterLevel(c.level);
    await c.flow.submitDrawing(INK);
    let top3HasTali = c.flow.prediction!.candidates.some((x) => x.label === "tali");
    while (top3HasTali) {
      c.flow.requestRedraw("evaluation");
      await c.flow.submitDrawing(INK);
      top3HasTali = c.flow.prediction!.candidates.some((x) => x.label === "tali");
    }
    c.flow.decideOverride("tali");
    expect(c.flow.behavior).toBe("danger");
    c.flow.completeFall();
    c.flow.commitPlacement();
    c.flow.reportGameplayOutcome("fail");
    expect(c.flow.phase).toBe("drawing");
    expect(c.flow.decision).toBeNull();
  });

  it("AC-13 repeat cycles honor cyclesRequired until completion", async () => {
    const c = makeFlow("stage-2-ambiguity"); // cyclesRequired = 2
    c.flow.enterLevel(c.level);
    await c.flow.submitDrawing(INK);
    let top3 = c.flow.prediction!.candidates.map((x) => x.label);
    let alt = ["papan", "batu", "tangga", "tali"].find((v) => !top3.includes(v))!;
    c.flow.decideOverride(alt);
    c.flow.completeFall();
    c.flow.commitPlacement();
    c.flow.reportGameplayOutcome("success");
    expect(c.flow.phase).toBe("drawing");
    expect(c.flow.cyclesCompleted).toBe(1);

    await c.flow.submitDrawing(INK);
    c.flow.decideAccept();
    c.flow.completeFall();
    c.flow.commitPlacement();
    c.flow.reportGameplayOutcome("success");
    expect(c.flow.phase).toBe("complete");
    expect(c.flow.cyclesCompleted).toBe(2);
  });

  it("guards illegal transitions (no silent phase jumps)", async () => {
    expect(() => ctx.flow.decideAccept()).toThrow(InvalidTransitionError);
    expect(() => ctx.flow.requestRedraw("evaluation")).toThrow(InvalidTransitionError);
    await drawAndSubmit();
    expect(() => ctx.flow.enterLevel(ctx.level)).toThrow(InvalidTransitionError);
  });

  it("notifies React subscribers on every transition (TASK 03)", async () => {
    let count = 0;
    const unsub = ctx.flow.subscribe(() => count++);
    ctx.flow.enterLevel(ctx.level);
    await ctx.flow.submitDrawing(INK);
    ctx.flow.decideAccept();
    ctx.flow.completeFall();
    ctx.flow.commitPlacement();
    ctx.flow.reportGameplayOutcome("success");
    unsub();
    ctx.flow.exitToLevelEntry();
    expect(count).toBeGreaterThanOrEqual(6); // enter, predicting, evaluating, falling, placing, gameplay, outcome...
  });

  it("emits typed interaction events on the seam (FR-18)", async () => {
    await drawAndSubmit();
    ctx.flow.decideAccept();
    ctx.flow.completeFall();
    ctx.flow.commitPlacement();
    ctx.flow.reportGameplayOutcome("success");
    const kinds = ctx.events.map((e) => e.kind);
    for (const k of [
      "drawing_submitted",
      "prediction_displayed",
      "decision_made",
      "gameplay_result",
      "cycle_completed",
    ] as const) {
      expect(kinds).toContain(k);
    }
  });

  it("all levels expose complete DEV config fields (TASK 10)", () => {
    for (const lv of LEVELS) {
      expect(lv.cyclesRequired).toBeGreaterThan(0);
      expect(lv.vocabulary.length).toBeGreaterThanOrEqual(3);
      expect(Object.keys(lv.behaviorMap).length).toBeGreaterThan(0);
      expect(lv.scene.goalX).toBeGreaterThan(0);
    }
  });

  it("falling phase allows redraw back to drawing", async () => {
    await drawAndSubmit();
    ctx.flow.decideAccept();
    expect(ctx.flow.phase).toBe("falling");
    ctx.flow.requestRedraw("evaluation");
    expect(ctx.flow.phase).toBe("drawing");
  });

  it("placing phase allows reposition back to placing from gameplay", async () => {
    await drawAndSubmit();
    ctx.flow.decideAccept();
    ctx.flow.completeFall();
    ctx.flow.commitPlacement();
    expect(ctx.flow.phase).toBe("gameplay");
    ctx.flow.repositionObject();
    expect(ctx.flow.phase).toBe("placing");
  });
});


describe("FlowController — optional goal completion", () => {
  it.each(LEVELS)("completes $levelId after one reported goal success when opted in", async level => {
    const provider = new MockPredictionProvider({ vocabulary: level.vocabulary, stage: level.stage, latencyMs: 0 });
    const flow = new FlowController({ provider, goalCompletesLevel: true });
    flow.enterLevel(level);
    await flow.submitDrawing(INK);
    flow.decideAccept();
    flow.completeFall();
    flow.commitPlacement();
    flow.reportGameplayOutcome("success");
    expect(flow.phase).toBe("complete");
    expect(flow.cyclesCompleted).toBe(1);
  });

  it("does not complete on failure when opted in", async () => {
    const level = getLevel("stage-2-ambiguity")!;
    const provider = new MockPredictionProvider({ vocabulary: level.vocabulary, stage: level.stage, latencyMs: 0 });
    const flow = new FlowController({ provider, goalCompletesLevel: true });
    flow.enterLevel(level);
    await flow.submitDrawing(INK);
    flow.decideAccept();
    flow.completeFall();
    flow.commitPlacement();
    flow.reportGameplayOutcome("fail");
    expect(flow.phase).toBe("drawing");
    expect(flow.cyclesCompleted).toBe(0);
  });
});
