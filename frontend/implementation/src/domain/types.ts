/**
 * Core product/domain types for the Sketchbook Universe author-side app.
 *
 * INTERNAL normalization contracts (PRD FR-17) — NOT the final partner wire
 * schema. Partner classifier/backend remain behind interfaces.
 */

export type ObjectBehavior = "solid" | "danger" | "unresolved";

/** A single AI prediction candidate. */
export interface PredictionCandidate {
  label: string;
  /** Confidence in [0,1]. Display value, not proof of correctness (PG-01). */
  confidence: number;
}

/** Exactly-Top-3 prediction result shape returned by any PredictionProvider. */
export interface PredictionResult {
  candidates: [PredictionCandidate, PredictionCandidate, PredictionCandidate];
}

export interface StrokePoint {
  x: number;
  y: number;
  /** Optional ink diameter. Raw strokes use CSS pixels; normalized strokes use bbox-relative units. */
  width?: number;
  /** Optional ink alpha in [0,1]. */
  opacity?: number;
}

/**
 * Normalized drawing input handed to a prediction provider.
 * Strokes are bbox-normalized to [0,1] so any input modality
 * (pointer/touch or MediaPipe hand) produces the same geometry.
 */
export interface DrawingInput {
  strokes: StrokePoint[][];
  /** True when the student produced at least one stroke with ink. */
  hasInk: boolean;
  aspectRatio: number;
}

export type DecisionType = "accept" | "correct" | "override";

/**
 * The resolved human decision consumed by gameplay.
 * Gameplay must consume THIS — never raw rank-1 output (FR-08).
 */
export type HumanDecision =
  | { type: "accept"; finalLabel: string; sourceRank: 1 }
  | { type: "correct"; finalLabel: string; sourceRank: 2 | 3 }
  | { type: "override"; finalLabel: string };

export interface SceneSpec {
  groundEndX: number;
  gapStartX: number;
  gapWidth: number;
  goalX: number;
}

export interface LevelContext {
  levelId: string;
  stage: 1 | 2 | 3;
  /**
   * DEV/PLACEHOLDER pacing: successful draw→decide→consequence cycles needed
   * to complete the level. Temporary dev value, not final level design.
   */
  cyclesRequired: number;
  /**
   * Context-aware label→behavior mapping for this level only.
   * No object is globally Solid/Danger (FR-09).
   */
  behaviorMap: Record<string, Exclude<ObjectBehavior, "unresolved">>;
  /** Labels offered by the Override picker for this level. */
  vocabulary: string[];
  /** DEV/PLACEHOLDER scene layout consumed by the gameplay runtime. */
  scene: SceneSpec;
}

/** Outcome of resolving behavior for a decided label. */
export type BehaviorResolution =
  | { kind: "solid" }
  | { kind: "danger" }
  | { kind: "fallback"; fallbackLabel: string };
