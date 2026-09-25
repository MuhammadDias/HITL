import type { HumanDecision, PredictionResult } from "./types";

/**
 * Resolves the student's explicit decision into a validated HumanDecision.
 * Pure logic — no DOM. Gameplay consumes this result, never raw rank-1 (FR-08).
 */
export class DecisionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DecisionError";
  }
}

/** FR-04: Accept means the student agrees with rank 1. */
export function acceptDecision(result: PredictionResult): HumanDecision {
  return {
    type: "accept",
    finalLabel: result.candidates[0].label,
    sourceRank: 1,
  };
}

/**
 * FR-05: Correct means the intended label is in Top-3 but not rank 1.
 * Only ranks 2 and 3 are valid; Correct is not arbitrary text override.
 */
export function correctDecision(
  result: PredictionResult,
  rank: 2 | 3,
): HumanDecision {
  if (rank !== 2 && rank !== 3) {
    throw new DecisionError(`Correct hanya menerima peringkat 2 atau 3 (diterima: ${rank}).`);
  }
  const candidate = result.candidates[rank - 1];
  if (!candidate) {
    throw new DecisionError(`Tidak ada kandidat pada peringkat ${rank}.`);
  }
  return {
    type: "correct",
    finalLabel: candidate.label,
    sourceRank: rank,
  };
}

/**
 * FR-06: Override rejects all Top-3 candidates; the alternative becomes final.
 * Empty/whitespace labels are rejected. A label equal to one already present
 * in Top-3 is rejected — that would be Correct's job, not Override's.
 */
export function overrideDecision(
  rawLabel: string,
  result: PredictionResult,
): HumanDecision {
  const label = rawLabel.trim();
  if (label.length === 0) {
    throw new DecisionError("Override butuh label yang tidak kosong.");
  }
  if (result.candidates.some((c) => c.label === label)) {
    throw new DecisionError(
      `Label "${label}" ada di Top-3 — gunakan Correct untuk memilihnya.`,
    );
  }
  return { type: "override", finalLabel: label };
}
