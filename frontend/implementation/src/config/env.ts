import type { InputModeId } from "../input/types";
import { MockPredictionProvider } from "../prediction/mock-prediction-provider";
import { PartnerHttpPredictionProvider } from "../prediction/partner-http-provider";
import {
  PredictionError,
  type PredictionContext,
  type PredictionProvider,
} from "../prediction/prediction-provider";
import { parseExtraHeadersJson } from "../prediction/headers";
import type { OutOfVocabularyPolicy } from "../prediction/validation";
import { attemptContext } from "../events/attempt-context";
import { providerVocabulary, type LevelDefinition } from "../domain/levels";

/**
 * TASK 07 — Public env configuration (no secrets; safe NEXT_PUBLIC_* only).
 *
 * This is a STATIC client: every NEXT_PUBLIC_* value is inlined into the public
 * JS bundle at build time. NEVER put API keys, tokens or cookies here.
 * NOTE: Next.js only inlines literal `process.env.NEXT_PUBLIC_X` reads, so each
 * variable below is read by its full literal name (do not refactor into
 * `process.env[name]` or pass `process.env` around).
 */

function flag(value: string | undefined): boolean {
  return value === "1" || value === "true";
}

function rawPredictionMode(): string {
  return (process.env.NEXT_PUBLIC_PREDICTION_MODE ?? "").trim().toLowerCase();
}

function positiveInt(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export const env = {
  /** "partner" only when NEXT_PUBLIC_PREDICTION_MODE is exactly partner (case-insensitive); everything else is "mock". */
  get predictionMode(): "mock" | "partner" {
    return rawPredictionMode() === "partner" ? "partner" : "mock";
  },
  /**
   * True when NEXT_PUBLIC_PREDICTION_MODE is set to something other than
   * mock|partner (e.g. a typo like "real"). createPredictionProvider() then
   * returns a config-error provider instead of silently serving mock output.
   */
  get predictionModeInvalid(): boolean {
    const m = rawPredictionMode();
    return m !== "" && m !== "mock" && m !== "partner";
  },
  get predictionEndpoint(): string {
    return (process.env.NEXT_PUBLIC_PREDICTION_ENDPOINT ?? "").trim();
  },
  get predictionTimeoutMs(): number {
    const n = Number(process.env.NEXT_PUBLIC_PREDICTION_TIMEOUT_MS);
    return Number.isFinite(n) && n > 0 ? n : 8000;
  },
  /**
   * PROPOSED. "allow" (default, = historical behaviour) | "reject" (labels outside
   * the level vocabulary become PredictionError "out-of-vocabulary").
   */
  get predictionOutOfVocabulary(): OutOfVocabularyPolicy {
    return (process.env.NEXT_PUBLIC_PREDICTION_OOV_POLICY ?? "").trim().toLowerCase() === "reject" ? "reject" : "allow";
  },
  /** PROPOSED, default OFF: send levelId/attemptId/contractVersion (+ X-Contract-Version header). */
  get predictionSendContext(): boolean {
    return flag(process.env.NEXT_PUBLIC_PREDICTION_SEND_CONTEXT);
  },
  /**
   * Raw JSON of NON-SECRET extra headers, e.g. {"X-Contract-Version":"1.0.0-draft"}.
   * Credential-looking names/values are dropped by sanitizeExtraHeaders (a static client cannot keep a secret).
   */
  get predictionHeadersJson(): string {
    return process.env.NEXT_PUBLIC_PREDICTION_HEADERS_JSON ?? "";
  },
  get defaultDrawInputMode(): InputModeId {
    return (process.env.NEXT_PUBLIC_DRAW_INPUT_MODE as InputModeId) ?? "pointer";
  },
  get mediapipeModelUrl(): string {
    return process.env.NEXT_PUBLIC_MEDIAPIPE_MODEL_URL ?? "/models/hand_landmarker.task";
  },
  /** Backend base URL for class links/answers; defaults to the prediction endpoint's origin. */
  get apiBaseUrl(): string {
    const explicit = process.env.NEXT_PUBLIC_API_URL;
    if (explicit) return explicit.replace(/\/+$/, "");
    try {
      return new URL(process.env.NEXT_PUBLIC_PREDICTION_ENDPOINT ?? "").origin;
    } catch {
      return "";
    }
  },
  get testHooksEnabled(): boolean {
    return process.env.NEXT_PUBLIC_TEST_HOOKS === "1";
  },

  // ---- event pipeline (DRAFT; see docs/execution/PARTNER_CONTRACT_ACTUAL.md) ----
  /** Unset/empty => HTTP event sink disabled => nothing is sent anywhere. */
  get eventEndpoint(): string {
    return (process.env.NEXT_PUBLIC_EVENT_ENDPOINT ?? "").trim();
  },
  /** Explicit flag to keep the console sink on in production builds (otherwise DEV only). */
  get eventConsoleEnabled(): boolean {
    return flag(process.env.NEXT_PUBLIC_EVENT_CONSOLE);
  },
  /** OPT-IN, default OFF: add studentNumber to event envelopes. See EventEnvelope for the PII reasoning. */
  get eventIncludeStudentNumber(): boolean {
    return flag(process.env.NEXT_PUBLIC_EVENT_INCLUDE_STUDENT_NUMBER);
  },
  get eventBatchSize(): number {
    return positiveInt(process.env.NEXT_PUBLIC_EVENT_BATCH_SIZE, 20);
  },
  get eventFlushIntervalMs(): number {
    return positiveInt(process.env.NEXT_PUBLIC_EVENT_FLUSH_INTERVAL_MS, 5000);
  },
  /** True for non-production builds (Next inlines NODE_ENV). */
  get isDevBuild(): boolean {
    return process.env.NODE_ENV !== "production";
  },
};

/** A provider that only ever fails loudly: used for REAL/unknown-config states. NEVER fabricates output. */
function configErrorProvider(message: string): PredictionProvider {
  return {
    predict: async () => {
      throw new PredictionError("provider-unavailable", message);
    },
  };
}

/**
 * Provider factory: mock by default; partner adapter only when explicitly
 * configured. Any partner/unknown-config state yields a clearly-labeled config
 * error provider — never fabricated output (FR-02/NFR-05).
 */
export function createPredictionProvider(level: LevelDefinition): PredictionProvider {
  if (env.predictionModeInvalid) {
    return configErrorProvider(
      `NEXT_PUBLIC_PREDICTION_MODE tidak dikenal (gunakan "mock" atau "partner"). Tidak ada prediksi yang dibuat.`,
    );
  }
  if (env.predictionMode === "partner") {
    if (!env.predictionEndpoint) {
      // Config error surfaces as recoverable prediction failure in the UI.
      return configErrorProvider("NEXT_PUBLIC_PREDICTION_MODE=partner tetapi NEXT_PUBLIC_PREDICTION_ENDPOINT kosong.");
    }
    const headers = parseExtraHeadersJson(env.predictionHeadersJson);
    if (env.isDevBuild && (headers.parseError || headers.rejected.length > 0)) {
      // eslint-disable-next-line no-console
      console.warn(
        "[prediction-config] NEXT_PUBLIC_PREDICTION_HEADERS_JSON:",
        headers.parseError ? "invalid JSON, ignored" : `refused (credential-like or reserved): ${headers.rejected.join(", ")}`,
      );
    }
    try {
      return new PartnerHttpPredictionProvider({
        endpoint: env.predictionEndpoint,
        timeoutMs: env.predictionTimeoutMs,
        vocabulary: providerVocabulary(level),
        outOfVocabulary: env.predictionOutOfVocabulary,
        extraHeaders: headers.headers,
        sendContext: env.predictionSendContext,
        contextProvider: (): PredictionContext => ({ levelId: level.levelId, attemptId: attemptContext.current() }),
        onProvenance: (p) => attemptContext.noteProvenance(p),
      });
    } catch (err) {
      // e.g. endpoint is not http(s): must not crash the app, must not fall back to mock.
      return configErrorProvider(err instanceof Error ? err.message : "Konfigurasi endpoint partner tidak valid.");
    }
  }
  return new MockPredictionProvider({
    vocabulary: providerVocabulary(level),
    stage: level.stage,
    latencyMs: 500,
  });
}
