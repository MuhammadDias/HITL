import { describe, expect, it } from "vitest";
import { CreationStore, type WorldCreation } from "@/src/game/creation-store";
import { FlowController } from "@/src/app/state-machine";
import { getLevel } from "@/src/domain/levels";
import { MockPredictionProvider } from "@/src/prediction/mock-prediction-provider";

const creation = (id: string): WorldCreation => ({
  id, label: "papan", behavior: "solid",
  drawingInput: { hasInk: true, aspectRatio: 2, strokes: [[{ x: 0, y: 0 }, { x: 1, y: 1 }]] },
  x: 100, y: 200, w: 80, h: 8,
});

describe("CreationStore — current-level in-memory creations", () => {
  it.each(["stage-1-foundation", "stage-2-ambiguity", "stage-3-validation"])("has no level-number quota: %s", levelId => {
    const store = new CreationStore();
    store.enterLevel(levelId);
    for (let i = 0; i < 100; i++) store.upsert(creation(String(i)));
    expect(store.snapshot()).toHaveLength(100);
  });

  it("repositions and updates by id without duplicating or changing other creations", () => {
    const store = new CreationStore();
    store.enterLevel("level-1");
    store.upsert(creation("first"));
    store.upsert(creation("second"));
    store.upsert({ ...creation("first"), x: 450, y: 90, label: "batu", behavior: "danger", drawingInput: null });
    expect(store.snapshot()).toEqual([
      { ...creation("first"), x: 450, y: 90, label: "batu", behavior: "danger", drawingInput: null },
      creation("second"),
    ]);
    store.remove("first");
    store.remove("missing");
    expect(store.snapshot()).toEqual([creation("second")]);
  });

  it("keeps snapshots and drawing data isolated from caller mutation", () => {
    const store = new CreationStore();
    const input = creation("one");
    store.upsert(input);
    input.x = 999;
    input.drawingInput!.strokes[0]![0]!.x = 999;
    const snapshot = store.snapshot();
    snapshot[0]!.y = 999;
    snapshot[0]!.drawingInput!.strokes[0]![0]!.y = 999;
    snapshot.push(creation("extra"));
    expect(store.snapshot()).toEqual([creation("one")]);
  });

  it("replaces committed runtime state; new level and same-level restart both clear it", () => {
    const store = new CreationStore();
    store.enterLevel("level-1");
    store.replace([creation("one"), creation("two")]);
    expect(store.snapshot()).toHaveLength(2);
    store.enterLevel("level-2");
    expect(store.snapshot()).toEqual([]);
    store.upsert(creation("three"));
    store.enterLevel("level-2");
    expect(store.snapshot()).toEqual([]);
    store.upsert(creation("four"));
    store.clear();
    expect(store.snapshot()).toEqual([]);
  });

  it("survives gameplay redraw/unmount and prediction retry; only committed objects exist", async () => {
    const level = getLevel("stage-1-foundation")!;
    const provider = new MockPredictionProvider({ vocabulary: level.vocabulary, stage: level.stage, latencyMs: 0 });
    const flow = new FlowController({ provider });
    const store = new CreationStore();
    store.enterLevel(level.levelId);
    flow.enterLevel(level);
    await flow.submitDrawing(creation("one").drawingInput!);
    flow.decideAccept();
    expect(store.snapshot()).toEqual([]);
    flow.completeFall();
    store.upsert(creation("one"));
    flow.commitPlacement();
    flow.requestRedraw("gameplay");
    expect(store.snapshot()).toEqual([creation("one")]);
    provider.setMode("fail");
    await flow.submitDrawing(creation("two").drawingInput!);
    expect(flow.phase).toBe("prediction-error");
    provider.setMode("normal");
    await flow.retryPrediction();
    expect(flow.phase).toBe("evaluating");
    expect(store.snapshot()).toEqual([creation("one")]);
  });
});
