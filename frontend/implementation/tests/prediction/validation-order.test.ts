import { describe, expect, it } from "vitest";
import { validatePredictionResponse } from "../../src/prediction/validation";

const c = (label: string, confidence: number) => ({ label, confidence });
describe("Top-3 response validation: ranking integrity", () => {
  it("accepts descending (ties allowed) distinct labels", () => {
    expect(validatePredictionResponse({ candidates: [c("a", 0.5), c("b", 0.5), c("c", 0.1)] }).candidates).toHaveLength(3);
  });
  it("rejects an unsorted response (rank 1 must be the highest confidence)", () => {
    expect(() => validatePredictionResponse({ candidates: [c("a", 0.2), c("b", 0.7), c("c", 0.1)] })).toThrow(/berurutan/);
  });
  it("rejects duplicate labels (Correct #2 would equal rank 1)", () => {
    expect(() => validatePredictionResponse({ candidates: [c("a", 0.7), c("a", 0.2), c("c", 0.1)] })).toThrow(/duplikat/);
  });
});
