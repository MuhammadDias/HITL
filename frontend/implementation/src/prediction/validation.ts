import type { PredictionResult } from "../domain/types";
import { PredictionError } from "./prediction-provider";

/**
 * Runtime validation of provider responses: guards against malformed payloads
 * so a broken/misbehaving provider can never silently become fabricated
 * output (FR-02, TASK 07, TASK 13 wrong-Top-3-count / invalid-confidence).
 */
export function validatePredictionResponse(value: unknown): PredictionResult {
  if (
    value === null ||
    typeof value !== "object" ||
    !("candidates" in value) ||
    !Array.isArray((value as { candidates: unknown }).candidates)
  ) {
    throw new PredictionError("malformed-response", "Respons prediksi tidak memiliki daftar kandidat.");
  }
  const candidates = (value as { candidates: unknown[] }).candidates;
  if (candidates.length !== 3) {
    throw new PredictionError(
      "malformed-response",
      `Respons prediksi harus berisi tepat 3 kandidat (diterima: ${candidates.length}).`,
    );
  }
  const parsed = candidates.map((c, i) => {
    if (c === null || typeof c !== "object") {
      throw new PredictionError("malformed-response", `Kandidat #${i + 1} bukan objek yang valid.`);
    }
    const { label, confidence } = c as { label?: unknown; confidence?: unknown };
    if (typeof label !== "string" || label.trim().length === 0) {
      throw new PredictionError("malformed-response", `Kandidat #${i + 1} tidak memiliki label teks.`);
    }
    if (typeof confidence !== "number" || Number.isNaN(confidence) || confidence < 0 || confidence > 1) {
      throw new PredictionError("malformed-response", `Confidence kandidat #${i + 1} di luar rentang [0,1].`);
    }
    return { label: label.trim(), confidence };
  });
  return {
    candidates: parsed as [PredictionResult["candidates"][0], PredictionResult["candidates"][1], PredictionResult["candidates"][2]],
  };
}
