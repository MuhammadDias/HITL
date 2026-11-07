import type { DrawingInput, PredictionResult, PredictionCandidate } from "../domain/types";
import { PredictionError } from "./prediction-provider";
import { validatePredictionResponse } from "./validation";

/**
 * ============================================================================
 * MODEL INTEGRATION CONTRACT — Types, Schemas, and Verification Helpers
 * ============================================================================
 * [DRAFT / PENDING PARTNER CONFIRMATION — Handshake Nov 1, 2026]
 *
 * NOTE: The schemas, constants, and validation rules below represent author-side
 * prototype assumptions for initial scaffolding and testing.
 * They are NOT rigid constraints on the partner classifier model or backend.
 *
 * The validator is designed to be forgiving:
 * 1. Labels: Accepts ANY non-empty string. Not constrained to 7 prototype labels.
 * 2. Confidence: Accepts any number in [0.0, 1.0]. Does NOT enforce sum=1.0.
 * 3. Fallback: Unknown labels resolve gracefully to gameplay fallback.
 */

/**
 * [DRAFT / PENDING PARTNER] Wire request payload sent to partner endpoint.
 * Normalization ([0..1] bounding box + aspectRatio) is an author-side convention.
 */
export interface PartnerRequestPayload {
  drawing: DrawingInput;
}

/**
 * [DRAFT / PENDING PARTNER] Wire response payload expected from partner endpoint.
 * Default prototype expectation is Top-3 candidates with confidence in [0, 1].
 */
export interface PartnerResponsePayload {
  candidates: [
    { label: string; confidence: number },
    { label: string; confidence: number },
    { label: string; confidence: number }
  ];
}

/**
 * [DRAFT / PENDING PARTNER] Canonical confidence bounds (inclusive).
 * Author validator accepts [0.0, 1.0]. Sum=1.0 is recommended but NOT enforced.
 */
export const CONFIDENCE_MIN = 0;
export const CONFIDENCE_MAX = 1;

/**
 * [DRAFT / PENDING PARTNER] Candidate count expected by author prototype UI.
 * Subject to partner confirmation on Nov 1.
 */
export const REQUIRED_CANDIDATE_COUNT = 3;

/**
 * [DRAFT / PENDING PARTNER] Prototype vocabulary used author-side.
 * This is an author-side reference vocabulary, NOT a restriction on partner model.
 */
export const PROTOTYPE_VOCABULARY = [
  "balok",
  "batu",
  "duri",
  "ember",
  "papan",
  "tali",
  "tangga",
] as const;

/**
 * Validates a partner response payload at runtime.
 * Forgiving validation:
 * - Checks candidates array exists and has length 3.
 * - Checks label is a non-empty string (any string accepted, not limited to prototype vocabulary).
 * - Checks confidence is a number in [0, 1] (does NOT require sum=1.0).
 * Throws PredictionError with reason "malformed-response" on fatal structural violation.
 */
export function validatePartnerResponse(payload: unknown): PartnerResponsePayload {
  return validatePredictionResponse(payload) as PartnerResponsePayload;
}

/**
 * Validates a partner request payload (author-side construction).
 * Ensures DrawingInput conforms to normalization contract before sending.
 */
export function validatePartnerRequest(payload: unknown): PartnerRequestPayload {
  if (
    payload === null ||
    typeof payload !== "object" ||
    !("drawing" in payload)
  ) {
    throw new PredictionError("malformed-response", "Request payload missing drawing field.");
  }
  const drawing = (payload as { drawing: unknown }).drawing;
  if (
    drawing === null ||
    typeof drawing !== "object" ||
    !("strokes" in drawing) ||
    !("hasInk" in drawing) ||
    !("aspectRatio" in drawing)
  ) {
    throw new PredictionError("malformed-response", "DrawingInput missing required fields.");
  }
  const { strokes, hasInk, aspectRatio } = drawing as {
    strokes: unknown;
    hasInk: unknown;
    aspectRatio: unknown;
  };
  if (!Array.isArray(strokes)) {
    throw new PredictionError("malformed-response", "strokes must be an array.");
  }
  for (const stroke of strokes) {
    if (!Array.isArray(stroke)) {
      throw new PredictionError("malformed-response", "Each stroke must be an array of points.");
    }
    for (const pt of stroke) {
      if (
        pt === null ||
        typeof pt !== "object" ||
        typeof (pt as { x: unknown; y: unknown }).x !== "number" ||
        typeof (pt as { x: unknown; y: unknown }).y !== "number"
      ) {
        throw new PredictionError("malformed-response", "Stroke points must be { x: number, y: number }.");
      }
    }
  }
  if (typeof hasInk !== "boolean") {
    throw new PredictionError("malformed-response", "hasInk must be boolean.");
  }
  if (typeof aspectRatio !== "number" || Number.isNaN(aspectRatio) || aspectRatio <= 0) {
    throw new PredictionError("malformed-response", "aspectRatio must be a positive number.");
  }
  return payload as PartnerRequestPayload;
}

/**
 * Creates a valid example request for documentation / partner testing.
 */
export function createExampleRequest(): PartnerRequestPayload {
  return {
    drawing: {
      strokes: [
        [{ x: 0.1, y: 0.2 }, { x: 0.3, y: 0.4 }, { x: 0.5, y: 0.6 }],
        [{ x: 0.7, y: 0.8 }, { x: 0.9, y: 0.9 }],
      ],
      hasInk: true,
      aspectRatio: 1.333,
    },
  };
}

/**
 * Creates a valid example response for documentation / partner testing.
 */
export function createExampleResponse(labels: string[] = ["papan", "batu", "tali"]): PartnerResponsePayload {
  return {
    candidates: [
      { label: labels[0]!, confidence: 0.6 },
      { label: labels[1]!, confidence: 0.3 },
      { label: labels[2]!, confidence: 0.1 },
    ],
  };
}

/**
 * Contract verification helper for partner integration testing.
 * Returns { ok: true } if payload passes all contract rules, else { ok: false, errors: string[] }.
 * Does NOT throw — collects all violations for reporting.
 */
export function verifyPartnerContract(payload: unknown): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  try {
    validatePartnerResponse(payload);
  } catch (err) {
    if (err instanceof PredictionError) {
      errors.push(err.message);
    } else {
      errors.push(String(err));
    }
  }
  return { ok: errors.length === 0, errors };
}

/**
 * MOCK vs REAL provider type guard — for runtime logging / debugging.
 */
export function isMockProvider(provider: unknown): provider is { getMode(): string } {
  return typeof provider === "object" && provider !== null && "getMode" in provider;
}

/**
 * [DRAFT / PENDING PARTNER] Contract version marker.
 * Partner should echo this in response header or body when agreed.
 */
export const CONTRACT_VERSION = "1.0.0-draft";
