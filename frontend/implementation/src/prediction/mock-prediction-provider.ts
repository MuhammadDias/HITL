import type { DrawingInput } from "../domain/types";
import { PredictionError } from "./prediction-provider";
import { validatePredictionResponse } from "./validation";
import type { PredictionProvider } from "./prediction-provider";

/**
 * ============================================================================
 * DEV / MOCK PREDICTION PROVIDER — PLACEHOLDER (PRD FR-16)
 * ----------------------------------------------------------------------------
 * - Deterministic: same drawing shape → same fixture selection.
 * - Emits the Top-3/confidence SHAPE so UI + tests are exercisable.
 * - NEVER represents measured classifier performance; values are invented
 *   dev fixtures. UI labels this provider as a mock at all times.
 * - Supports injectable `fail` / `malformed` modes for error-path testing.
 * ============================================================================
 */

export type MockProviderMode = "normal" | "fail" | "malformed";

export interface MockPredictionProviderOptions {
  /** Candidate labels this level allows (Top-3 ⊆ vocabulary). */
  vocabulary: string[];
  /** Stage emphasis influences fixture confidence spreads (dev fixtures only). */
  stage: 1 | 2 | 3;
  mode?: MockProviderMode;
  /** Simulated latency in ms; default 500. Tests use small/0 values. */
  latencyMs?: number;
}

/** FNV-1a style deterministic hash over quantized stroke geometry. */
export function hashDrawingInput(input: DrawingInput): number {
  let hash = 0x811c9dc5;
  const push = (n: number) => {
    hash ^= n & 0xff;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  };
  for (const stroke of input.strokes) {
    for (const p of stroke) {
      // Quantize to reduce jitter sensitivity while staying deterministic.
      push(Math.round(p.x * 64));
      push(Math.round(p.y * 64));
    }
  }
  return hash >>> 0;
}

/** DEV fixture confidence spreads per stage emphasis. Not real model data. */
const STAGE_SPREADS: Record<1 | 2 | 3, [number, number, number]> = {
  1: [0.86, 0.09, 0.05],
  2: [0.42, 0.35, 0.23],
  3: [0.55, 0.38, 0.07],
};

function pickDistinctLabels(vocabulary: string[], seed: number): string[] {
  if (vocabulary.length < 3) {
    throw new Error("Mock provider membutuhkan minimal 3 label dalam vocabulary.");
  }
  const pool = [...vocabulary];
  const picked: string[] = [];
  let s = seed;
  while (picked.length < 3) {
    s = ((Math.imul(s, 1103515245) + 12345) >>> 0) || seed + picked.length + 1;
    const idx = s % pool.length;
    picked.push(pool.splice(idx, 1)[0]!);
  }
  return picked;
}

export class MockPredictionProvider implements PredictionProvider {
  private readonly latencyMs: number;
  private mode: MockProviderMode;

  constructor(private readonly options: MockPredictionProviderOptions) {
    this.mode = options.mode ?? "normal";
    this.latencyMs = options.latencyMs ?? 500;
  }

  setMode(mode: MockProviderMode): void {
    this.mode = mode;
  }

  getMode(): MockProviderMode {
    return this.mode;
  }

  async predict(input: DrawingInput): Promise<ReturnType<typeof validatePredictionResponse>> {
    await delay(this.latencyMs);

    if (this.mode === "fail") {
      throw new PredictionError(
        "provider-unavailable",
        "DEV MOCK: penyedia prediksi tidak tersedia.",
      );
    }
    if (this.mode === "malformed") {
      // Deliberately broken payload to exercise malformed-response handling.
      return validatePredictionResponse({ candidates: [{ label: "satu", confidence: 0.9 }] });
    }

    const seed = hashDrawingInput(input);
    const labels = pickDistinctLabels(this.options.vocabulary, seed);
    const [a, b, c] = STAGE_SPREADS[this.options.stage];
    return validatePredictionResponse({
      candidates: [
        { label: labels[0]!, confidence: a },
        { label: labels[1]!, confidence: b },
        { label: labels[2]!, confidence: c },
      ],
    });
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
