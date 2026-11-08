/**
 * Prediction provenance: where a result came from. ADDITIVE and OPTIONAL —
 * consumers that only read `candidates` are unaffected. Diagnostics/telemetry
 * only, never gameplay input.
 */
export interface PredictionProvenance {
  /** "mock" = local DEV fixture; "partner" = result of the partner HTTP adapter. */
  mode: "mock" | "partner";
  /** Model version reported by the partner (header X-Model-Version or body.modelVersion), if any. PROPOSED. */
  modelVersion?: string;
  /** Client-side measured latency of the predict() call, in ms. */
  latencyMs: number;
}

/**
 * Declaration merging: adds the optional `provenance` field to the existing
 * `PredictionResult` interface WITHOUT editing src/domain/types.ts (owned by
 * another work package). Folding it into types.ts later is a trivial move.
 */
declare module "../domain/types" {
  interface PredictionResult {
    provenance?: PredictionProvenance;
  }
}

/** Monotonic-ish clock in ms (performance.now when available). */
export function nowMs(): number {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }
  return Date.now();
}

/** Elapsed ms since `startedAt`, rounded to 1 ms, never negative. */
export function elapsedMs(startedAt: number): number {
  return Math.max(0, Math.round(nowMs() - startedAt));
}

const MODEL_VERSION_MAX = 128;

/**
 * Model version strings come from an untrusted partner and end up in logs:
 * accept only a printable, trimmed, length-capped string; otherwise drop it.
 */
export function sanitizeModelVersion(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const v = value.trim();
  if (v.length === 0 || v.length > MODEL_VERSION_MAX) return undefined;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(v)) return undefined;
  return v;
}

export function makeProvenance(
  mode: PredictionProvenance["mode"],
  latencyMs: number,
  modelVersion?: string,
): PredictionProvenance {
  return modelVersion ? { mode, latencyMs, modelVersion } : { mode, latencyMs };
}
