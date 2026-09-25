import { describe, expect, it } from "vitest";
import { validatePredictionResponse } from "@/src/prediction/validation";

describe("prediction response validation (TASK 07/13)", () => {
  it("accepts a valid Top-3 payload and trims labels", () => {
    const r = validatePredictionResponse({
      candidates: [
        { label: " papan ", confidence: 0.5 },
        { label: "batu", confidence: 0.3 },
        { label: "tali", confidence: 0.2 },
      ],
    });
    expect(r.candidates[0].label).toBe("papan");
    expect(r.candidates).toHaveLength(3);
  });

  it.each([
    ["non-object", null],
    ["missing candidates", {}],
    ["candidates not array", { candidates: "x" }],
    ["two candidates", { candidates: [{ label: "a", confidence: 0.5 }, { label: "b", confidence: 0.5 }] }],
    [
      "four candidates",
      {
        candidates: [
          { label: "a", confidence: 0.25 },
          { label: "b", confidence: 0.25 },
          { label: "c", confidence: 0.25 },
          { label: "d", confidence: 0.25 },
        ],
      },
    ],
    ["candidate not object", { candidates: [null, { label: "b", confidence: 0.5 }, { label: "c", confidence: 0.5 }] }],
    [
      "empty label",
      { candidates: [{ label: "", confidence: 0.5 }, { label: "b", confidence: 0.3 }, { label: "c", confidence: 0.2 }] },
    ],
    [
      "confidence > 1",
      { candidates: [{ label: "a", confidence: 1.4 }, { label: "b", confidence: 0.3 }, { label: "c", confidence: 0.2 }] },
    ],
    [
      "NaN confidence",
      { candidates: [{ label: "a", confidence: Number.NaN }, { label: "b", confidence: 0.3 }, { label: "c", confidence: 0.2 }] },
    ],
  ])("rejects %s as malformed-response", (_name, payload) => {
    try {
      validatePredictionResponse(payload);
      expect.unreachable("should have thrown");
    } catch (err) {
      expect((err as { reason?: string }).reason ?? (err as Error).name).toBeDefined();
      expect((err as Error).name).toBe("PredictionError");
      expect((err as { reason?: string }).reason).toBe("malformed-response");
    }
  });
});
