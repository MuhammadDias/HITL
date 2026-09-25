import type { DrawingInput, PredictionResult } from "../domain/types";

/**
 * FR-02 / FR-17 / TASK 07: Prediction-provider boundary.
 * Partner-owned classifier will implement this seam; the author side never
 * fabricates real model output (FR-02, NFR-05).
 */
export interface PredictionProvider {
  predict(input: DrawingInput): Promise<PredictionResult>;
}

/** Distinguishing failure kinds keeps recovery explicit (FR-15). */
export type PredictionFailureReason =
  | "provider-unavailable"
  | "timeout"
  | "malformed-response"
  | "unknown";

export class PredictionError extends Error {
  readonly reason: PredictionFailureReason;
  constructor(reason: PredictionFailureReason, message: string) {
    super(message);
    this.name = "PredictionError";
    this.reason = reason;
  }
}
