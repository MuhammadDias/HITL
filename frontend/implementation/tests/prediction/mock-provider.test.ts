import { describe, expect, it } from "vitest";
import { MockPredictionProvider, hashDrawingInput } from "@/src/prediction/mock-prediction-provider";
import type { DrawingInput } from "@/src/domain/types";

const INPUT: DrawingInput = {
  strokes: [[{ x: 0.1, y: 0.5 }, { x: 0.9, y: 0.5 }]],
  hasInk: true,
  aspectRatio: 1,
};
const VOCAB = ["papan", "batu", "tangga", "tali"];

describe("MockPredictionProvider (FR-16 DEV/MOCK)", () => {
  it("returns exactly three candidates with confidence in [0,1]", async () => {
    const p = new MockPredictionProvider({ vocabulary: VOCAB, stage: 1, latencyMs: 0 });
    const r = await p.predict(INPUT);
    expect(r.candidates).toHaveLength(3);
    for (const c of r.candidates) {
      expect(c.confidence).toBeGreaterThanOrEqual(0);
      expect(c.confidence).toBeLessThanOrEqual(1);
    }
  });

  it("is deterministic for identical input", async () => {
    const p = new MockPredictionProvider({ vocabulary: VOCAB, stage: 2, latencyMs: 0 });
    expect(await p.predict(INPUT)).toEqual(await p.predict(INPUT));
  });

  it("hash is stable", () => {
    expect(hashDrawingInput(INPUT)).toBe(hashDrawingInput({ ...INPUT }));
  });

  it("fail mode → explicit provider-unavailable (FR-02)", async () => {
    const p = new MockPredictionProvider({ vocabulary: VOCAB, stage: 1, latencyMs: 0, mode: "fail" });
    await expect(p.predict(INPUT)).rejects.toMatchObject({ reason: "provider-unavailable" });
  });

  it("malformed mode caught by validation (never silently passed)", async () => {
    const p = new MockPredictionProvider({ vocabulary: VOCAB, stage: 1, latencyMs: 0, mode: "malformed" });
    await expect(p.predict(INPUT)).rejects.toMatchObject({ reason: "malformed-response" });
  });

  it("mode can be toggled at runtime (used by error-path tests/E2E)", async () => {
    const p = new MockPredictionProvider({ vocabulary: VOCAB, stage: 3, latencyMs: 0 });
    expect(p.getMode()).toBe("normal");
    p.setMode("fail");
    await expect(p.predict(INPUT)).rejects.toBeDefined();
    p.setMode("normal");
    await expect(p.predict(INPUT)).resolves.toBeTruthy();
  });
});
