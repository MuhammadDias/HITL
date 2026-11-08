import { newId } from "./ids";

/**
 * Shared, tiny "current attempt" holder. An attempt = one draw -> decide cycle,
 * started by the envelope sink on `drawing_submitted`. The prediction adapter
 * reads it (attemptId for the PROPOSED request context) and writes back the
 * provenance it saw (modelVersion for the event envelope).
 */
export interface AttemptContext {
  /** Start a new attempt (clears model version) and return its id. */
  begin(): string;
  current(): string | undefined;
  /** Record provenance reported by the prediction provider for the current attempt. */
  noteProvenance(p: { mode?: "mock" | "partner"; modelVersion?: string }): void;
  modelVersion(): string | undefined;
  /** Mode last reported by a provider, if any. */
  providerMode(): "mock" | "partner" | undefined;
  reset(): void;
}

export function createAttemptContext(makeId: () => string = newId): AttemptContext {
  let attemptId: string | undefined;
  let modelVersion: string | undefined;
  let mode: "mock" | "partner" | undefined;
  return {
    begin() {
      attemptId = makeId();
      modelVersion = undefined;
      return attemptId;
    },
    current: () => attemptId,
    noteProvenance(p) {
      if (p.modelVersion) modelVersion = p.modelVersion;
      if (p.mode) mode = p.mode;
    },
    modelVersion: () => modelVersion,
    providerMode: () => mode,
    reset() {
      attemptId = undefined;
      modelVersion = undefined;
      mode = undefined;
    },
  };
}

/** Process-wide default shared by createEventSink() and createPredictionProvider(). */
export const attemptContext: AttemptContext = createAttemptContext();
