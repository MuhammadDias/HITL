import type { PredictionResult } from "../../domain/types";
import type { LevelDefinition } from "../../domain/levels";

export interface Top3PredictionPopupProps {
  /** Current phase of the drawing/prediction lifecycle. */
  phase: "predicting" | "evaluating" | "prediction-error";
  /** The 3 candidate predictions returned by the provider. */
  prediction: PredictionResult | null;
  /** Detailed error message when phase === "prediction-error". */
  errorDetail?: string | null;
  /** Whether the provider is in simulated/fixture mode or partner API mode. */
  predictionMode: "mock" | "partner";
  /** Level configuration containing vocabulary, stage, and goal. */
  level: LevelDefinition;
  /** Student accepts rank 1 candidate. */
  onAccept: () => void;
  /** Student chooses candidate #2 or #3 from Top-3. */
  onCorrect: (rank: 2 | 3) => void;
  /** Student overrides with an allowed vocabulary label. */
  onOverride: (label: string) => void;
  /** Student requests redraw/revision. */
  onRedraw: () => void;
  /** Student retries failed prediction. */
  onRetry: () => void;
}
