import type { PredictionResult } from "../domain/types";
import { PredictionError } from "./prediction-provider";

/**
 * Policy for labels that are not part of the level vocabulary.
 * - "allow"  (DEFAULT = historical behaviour): keep the label as-is. The
 *   behavior resolver later maps unknown labels to the inert "unresolved"
 *   placeholder, so the game cannot dead-end. This is not unsafe, only
 *   semantically loose (a student may "accept" a label the level knows nothing about).
 * - "reject" (PROPOSED, opt-in): throw PredictionError("out-of-vocabulary") so
 *   the UI offers redraw/retry instead of silently degrading to "unresolved".
 */
export type OutOfVocabularyPolicy = "allow" | "reject";

export interface ValidatePredictionOptions {
  /**
   * Level vocabulary. When given, labels are matched case-insensitively
   * (after trimming) and the EXACT canonical vocabulary spelling is returned.
   */
  vocabulary?: readonly string[];
  /** What to do with labels that match nothing in `vocabulary`. Default "allow". */
  outOfVocabulary?: OutOfVocabularyPolicy;
}

/**
 * Runtime validation of provider responses: guards against malformed payloads
 * so a broken/misbehaving provider can never silently become fabricated
 * output (FR-02, TASK 07, TASK 13 wrong-Top-3-count / invalid-confidence).
 *
 * Enforced: exactly 3 candidates; label = non-empty string (trimmed);
 * confidence = finite number in [0,1]; sorted descending (ties allowed);
 * labels unique (case-insensitive, after trimming/canonicalisation).
 */
export function validatePredictionResponse(
  value: unknown,
  options: ValidatePredictionOptions = {},
): PredictionResult {
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
  const canonical = buildCanonicalIndex(options.vocabulary);
  const reject = options.outOfVocabulary === "reject" && canonical !== undefined;
  const outOfVocab: string[] = [];

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
    const trimmed = label.trim();
    const match = canonical?.get(trimmed.toLowerCase());
    if (canonical && match === undefined) outOfVocab.push(trimmed);
    return { label: match ?? trimmed, confidence };
  });

  const seen = new Set(parsed.map((c) => c.label.toLowerCase()));
  if (seen.size !== parsed.length) {
    throw new PredictionError("malformed-response", "Label kandidat tidak boleh duplikat dalam Top-3.");
  }
  for (let i = 1; i < parsed.length; i++) {
    if (parsed[i]!.confidence > parsed[i - 1]!.confidence) {
      throw new PredictionError("malformed-response", "Kandidat harus berurutan dari confidence tertinggi (peringkat 1) ke terendah.");
    }
  }
  if (reject && outOfVocab.length > 0) {
    throw new PredictionError(
      "out-of-vocabulary",
      `Label di luar vocabulary level: ${outOfVocab.join(", ")}.`,
    );
  }
  return {
    candidates: parsed as [PredictionResult["candidates"][0], PredictionResult["candidates"][1], PredictionResult["candidates"][2]],
  };
}

/** lower-cased trimmed vocabulary entry -> exact canonical spelling (first wins). */
function buildCanonicalIndex(vocabulary: readonly string[] | undefined): Map<string, string> | undefined {
  if (!vocabulary || vocabulary.length === 0) return undefined;
  const index = new Map<string, string>();
  for (const entry of vocabulary) {
    const key = entry.trim().toLowerCase();
    if (key && !index.has(key)) index.set(key, entry.trim());
  }
  return index;
}
