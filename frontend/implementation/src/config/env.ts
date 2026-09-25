import type { InputModeId } from "../input/types";
import { MockPredictionProvider } from "../prediction/mock-prediction-provider";
import { PartnerHttpPredictionProvider } from "../prediction/partner-http-provider";
import type { PredictionProvider } from "../prediction/prediction-provider";
import { providerVocabulary, type LevelDefinition } from "../domain/levels";

/**
 * TASK 07 — Public env configuration (no secrets; safe NEXT_PUBLIC_* only).
 */
export const env = {
  get predictionMode(): "mock" | "partner" {
    return (process.env.NEXT_PUBLIC_PREDICTION_MODE as "mock" | "partner") ?? "partner";
  },
  get predictionEndpoint(): string {
    return process.env.NEXT_PUBLIC_PREDICTION_ENDPOINT ?? "http://localhost:8000/predict";
  },
  get predictionTimeoutMs(): number {
    const n = Number(process.env.NEXT_PUBLIC_PREDICTION_TIMEOUT_MS);
    return Number.isFinite(n) && n > 0 ? n : 8000;
  },
  get defaultDrawInputMode(): InputModeId {
    return (process.env.NEXT_PUBLIC_DRAW_INPUT_MODE as InputModeId) ?? "hand";
  },
  get mediapipeModelUrl(): string {
    return process.env.NEXT_PUBLIC_MEDIAPIPE_MODEL_URL ?? "/models/hand_landmarker.task";
  },
  get testHooksEnabled(): boolean {
    return process.env.NEXT_PUBLIC_TEST_HOOKS === "1";
  },
};

/**
 * Provider factory: mock by default; partner adapter only when explicitly
 * configured. Falls back to a clearly-labeled config error provider when
 * partner mode lacks an endpoint — never fabricates output (FR-02/NFR-05).
 */
export function createPredictionProvider(level: LevelDefinition): PredictionProvider {
  if (env.predictionMode === "partner" && env.predictionEndpoint) {
    return new PartnerHttpPredictionProvider({
      endpoint: env.predictionEndpoint,
      timeoutMs: env.predictionTimeoutMs,
    });
  }
  if (env.predictionMode === "partner") {
    // Config error surfaces as recoverable prediction failure in the UI.
    return {
      predict: async () => {
        throw new (await import("../prediction/prediction-provider")).PredictionError(
          "provider-unavailable",
          "NEXT_PUBLIC_PREDICTION_MODE=partner tetapi NEXT_PUBLIC_PREDICTION_ENDPOINT kosong.",
        );
      },
    };
  }
  return new MockPredictionProvider({
    vocabulary: providerVocabulary(level),
    stage: level.stage,
    latencyMs: 500,
  });
}
