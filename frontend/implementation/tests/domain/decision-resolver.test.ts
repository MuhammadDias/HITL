import { describe, expect, it } from "vitest";
import { DecisionError, acceptDecision, correctDecision, overrideDecision } from "@/src/domain/decision-resolver";
import type { PredictionResult } from "@/src/domain/types";

const RESULT: PredictionResult = {
  candidates: [
    { label: "papan", confidence: 0.6 },
    { label: "batu", confidence: 0.3 },
    { label: "tali", confidence: 0.1 },
  ],
};

describe("decision resolver (TASK 02)", () => {
  it("accept resolves rank 1 (FR-04/AC-03)", () => {
    expect(acceptDecision(RESULT)).toEqual({ type: "accept", finalLabel: "papan", sourceRank: 1 });
  });

  it("correct resolves rank 2 preserving rank (AC-04)", () => {
    expect(correctDecision(RESULT, 2)).toEqual({ type: "correct", finalLabel: "batu", sourceRank: 2 });
  });

  it("correct resolves rank 3 preserving rank (AC-05)", () => {
    expect(correctDecision(RESULT, 3)).toEqual({ type: "correct", finalLabel: "tali", sourceRank: 3 });
  });

  it("invalid Correct rejected (ranks outside 2|3)", () => {
    // @ts-expect-error runtime guard
    expect(() => correctDecision(RESULT, 1)).toThrow(DecisionError);
    // @ts-expect-error
    expect(() => correctDecision(RESULT, 4)).toThrow(DecisionError);
  });

  it("override resolves valid non-Top-3 label (AC-06)", () => {
    expect(overrideDecision("tangga", RESULT)).toEqual({ type: "override", finalLabel: "tangga" });
  });

  it("override rejects empty/whitespace (FR-15)", () => {
    expect(() => overrideDecision("", RESULT)).toThrow(DecisionError);
    expect(() => overrideDecision("   ", RESULT)).toThrow(DecisionError);
  });

  it("override rejects Top-3 duplicate labels", () => {
    for (const c of RESULT.candidates) {
      expect(() => overrideDecision(c.label, RESULT)).toThrow(DecisionError);
    }
  });
});
