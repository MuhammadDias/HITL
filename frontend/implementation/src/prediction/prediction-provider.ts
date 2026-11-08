import type { DrawingInput, PredictionResult } from "../domain/types";

/**
 * Optional, additive per-call context. Providers MAY ignore it. The partner
 * HTTP adapter only puts it on the wire when `sendContext` is enabled
 * (PROPOSED field set — see docs/execution/PARTNER_CONTRACT_ACTUAL.md).
 */
export interface PredictionContext {
  levelId?: string;
  attemptId?: string;
}

/**
 * FR-02 / FR-17 / TASK 07: Prediction-provider boundary.
 * Partner-owned classifier will implement this seam; the author side never
 * fabricates real model output (FR-02, NFR-05).
 */
export interface PredictionProvider {
  predict(input: DrawingInput, context?: PredictionContext): Promise<PredictionResult>;
}

/** Distinguishing failure kinds keeps recovery explicit (FR-15). */
export type PredictionFailureReason =
  | "provider-unavailable"
  | "timeout"
  | "malformed-response"
  /**
   * PROPOSED / opt-in (config `outOfVocabulary: "reject"`): the response was
   * structurally valid but contained a label outside the level vocabulary.
   */
  | "out-of-vocabulary"
  | "unknown";

export class PredictionError extends Error {
  readonly reason: PredictionFailureReason;
  /** HTTP status when the failure came from a non-2xx response (diagnostics only). */
  readonly httpStatus?: number;
  constructor(reason: PredictionFailureReason, message: string, httpStatus?: number) {
    super(message);
    this.name = "PredictionError";
    this.reason = reason;
    if (httpStatus !== undefined) this.httpStatus = httpStatus;
  }
}
