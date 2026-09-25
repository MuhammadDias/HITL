import type {
  DrawingInput,
  HumanDecision,
  LevelContext,
  ObjectBehavior,
  PredictionResult,
} from "../domain/types";
import { DecisionError, acceptDecision, correctDecision, overrideDecision } from "../domain/decision-resolver";
import { resolveBehavior } from "../domain/behavior-resolver";
import { PredictionError, type PredictionProvider } from "../prediction/prediction-provider";
import { noopSink, type InteractionEvent, type InteractionEventSink } from "../domain/events";

/**
 * TASK 02/03 — App-level state machine implementing the PRD §13 flow.
 * Pure logic — independent of React and KAPLAY. Single source of truth for
 * phase; React subscribes to snapshots (see app-reducer.ts / useFlow.ts).
 *
 * Phases: level-entry → drawing → predicting → evaluating → gameplay → (drawing|complete)
 *         predicting └→ prediction-error → (predicting | drawing)
 * Redraw is a recovery action back to drawing — never a fourth peer decision.
 */

export type AppPhase =
  | "level-entry"
  | "drawing"
  | "predicting"
  | "prediction-error"
  | "evaluating"
  | "gameplay"
  | "complete";

export class InvalidTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidTransitionError";
  }
}

export interface FlowOptions {
  provider: PredictionProvider;
  sink?: InteractionEventSink;
}

export type FlowFeedback = "empty-drawing" | "prediction-failed" | null;

export interface FlowStateSnapshot {
  phase: AppPhase;
  levelId: string | null;
  hasPrediction: boolean;
  decision: HumanDecision | null;
  behavior: ObjectBehavior | null;
  cyclesCompleted: number;
}

type Listener = () => void;

export class FlowController {
  phase: AppPhase = "level-entry";
  level: LevelContext | null = null;
  drawingInput: DrawingInput | null = null;
  prediction: PredictionResult | null = null;
  decision: HumanDecision | null = null;
  behavior: ObjectBehavior | null = null;
  feedback: FlowFeedback = null;
  errorDetail: string | null = null;
  cyclesCompleted = 0;

  private readonly provider: PredictionProvider;
  private readonly sink: InteractionEventSink;
  private readonly listeners = new Set<Listener>();

  constructor(options: FlowOptions) {
    this.provider = options.provider;
    this.sink = options.sink ?? noopSink;
  }

  /* ---------------- React subscription ---------------- */

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getSnapshot(): FlowStateSnapshot {
    return {
      phase: this.phase,
      levelId: this.level?.levelId ?? null,
      hasPrediction: this.prediction !== null,
      decision: this.decision,
      behavior: this.behavior,
      cyclesCompleted: this.cyclesCompleted,
    };
  }

  private notify(): void {
    for (const l of [...this.listeners]) l();
  }

  private emit(event: InteractionEvent): void {
    this.sink.emit(event);
  }

  private require(phase: AppPhase, action: string): void {
    if (this.phase !== phase) {
      throw new InvalidTransitionError(
        `"${action}" hanya valid dari fase "${phase}" (fase saat ini: "${this.phase}").`,
      );
    }
  }

  /* ---------------- transitions ---------------- */

  enterLevel(level: LevelContext): void {
    if (this.phase !== "level-entry") {
      throw new InvalidTransitionError(
        `Masuk level hanya dari pemilihan level (fase saat ini: "${this.phase}").`,
      );
    }
    this.level = level;
    this.resetCycleState();
    this.cyclesCompleted = 0;
    this.phase = "drawing";
    this.notify();
  }

  exitToLevelEntry(): void {
    if (this.phase === "predicting") {
      throw new InvalidTransitionError("Tidak bisa keluar saat prediksi sedang berjalan.");
    }
    this.level = null;
    this.drawingInput = null;
    this.prediction = null;
    this.decision = null;
    this.behavior = null;
    this.feedback = null;
    this.errorDetail = null;
    this.cyclesCompleted = 0;
    this.phase = "level-entry";
    this.notify();
  }

  /** FR-01/FR-15: empty drawings are rejected before touching the provider. */
  async submitDrawing(input: DrawingInput): Promise<void> {
    this.require("drawing", "submitDrawing");
    if (!input.hasInk) {
      this.feedback = "empty-drawing";
      this.notify();
      return;
    }
    this.feedback = null;
    this.drawingInput = input;
    this.emit({ kind: "drawing_submitted", levelId: this.level?.levelId ?? "?" });
    await this.runPrediction();
  }

  /** FR-02: retry after provider failure without full app restart (NFR-02). */
  async retryPrediction(): Promise<void> {
    this.require("prediction-error", "retryPrediction");
    if (!this.drawingInput) {
      throw new InvalidTransitionError("Tidak ada gambar tersimpan untuk dicoba ulang.");
    }
    await this.runPrediction();
  }

  /** Recovery route from the error state back to the canvas (FR-07). */
  redrawFromError(): void {
    this.require("prediction-error", "redrawFromError");
    this.emitRedraw("error");
    this.resetToDrawing();
  }

  private async runPrediction(): Promise<void> {
    const levelId = this.level?.levelId ?? "?";
    this.phase = "predicting";
    this.notify();
    try {
      const raw = await this.provider.predict(this.drawingInput!);
      this.prediction = raw;
      this.phase = "evaluating";
      this.emit({
        kind: "prediction_displayed",
        levelId,
        labels: this.prediction.candidates.map((c) => c.label),
      });
    } catch (err) {
      const reason =
        err instanceof PredictionError ? err.reason : err instanceof Error ? err.message : "unknown";
      this.errorDetail = reason;
      this.feedback = "prediction-failed";
      this.phase = "prediction-error";
      this.emit({ kind: "provider_error", levelId, reason });
    }
    this.notify();
  }

  /** FR-04 / AC-03. */
  decideAccept(): void {
    this.require("evaluating", "decideAccept");
    this.applyDecision(acceptDecision(this.prediction!), 1);
  }

  /** FR-05 / AC-04 / AC-05. Never auto-selects rank 2 — caller passes rank. */
  decideCorrect(rank: 2 | 3): void {
    this.require("evaluating", "decideCorrect");
    this.applyDecision(correctDecision(this.prediction!, rank), rank);
  }

  /** FR-06 / AC-06. Throws DecisionError for invalid labels; state unchanged. */
  decideOverride(label: string): void {
    this.require("evaluating", "decideOverride");
    this.applyDecision(overrideDecision(label, this.prediction!), undefined);
  }

  /**
   * Gameplay can ONLY be entered through an explicit human decision
   * (AC-07). Behavior resolution consumes the final label (FR-08/09).
   */
  private applyDecision(decision: HumanDecision, sourceRank: 1 | 2 | 3 | undefined): void {
    const level = this.level!;
    const resolved = resolveBehavior(decision.finalLabel, level);
    this.decision = decision;
    this.behavior = resolved.behavior;
    this.phase = "gameplay";
    this.emit({
      kind: "decision_made",
      levelId: level.levelId,
      decisionType: decision.type,
      sourceRank,
      finalLabel: decision.finalLabel,
    });
    this.notify();
  }

  /** FR-07/AC-08: recovery path back to the canvas, preserving level context. */
  requestRedraw(from: "evaluation" | "gameplay"): void {
    if (this.phase !== "evaluating" && this.phase !== "gameplay") {
      throw new InvalidTransitionError(
        `Redraw hanya valid dari evaluasi/gameplay (fase saat ini: "${this.phase}").`,
      );
    }
    this.emitRedraw(from);
    this.resetToDrawing();
  }

  /** FR-12/AC-10: outcome reporting with explicit recovery routes. */
  reportGameplayOutcome(outcome: "success" | "fail"): void {
    this.require("gameplay", "reportGameplayOutcome");
    const level = this.level!;
    const behavior = this.behavior!;
    this.emit({ kind: "gameplay_result", levelId: level.levelId, outcome, behavior });

    if (outcome === "fail") {
      this.resetToDrawing(); // fresh cycle at the canvas (FR-11/15)
      return;
    }

    this.cyclesCompleted += 1;
    if (this.cyclesCompleted >= level.cyclesRequired) {
      this.emit({ kind: "cycle_completed", levelId: level.levelId, cyclesUsed: this.cyclesCompleted });
      this.decision = null;
      this.behavior = null;
      this.prediction = null;
      this.drawingInput = null;
      this.phase = "complete";
    } else {
      this.resetToDrawing(); // repeat cycle within same level
    }
    this.notify();
  }

  /* ---------------- helpers ---------------- */

  private resetCycleState(): void {
    this.drawingInput = null;
    this.prediction = null;
    this.decision = null;
    this.behavior = null;
    this.feedback = null;
    this.errorDetail = null;
  }

  private resetToDrawing(): void {
    // A new cycle requires a fresh drawing; prediction retry only survives
    // inside prediction-error via drawingInput retention in runPrediction path.
    this.resetCycleState();
    this.drawingInput = null;
    this.phase = "drawing";
    this.notify();
  }

  private emitRedraw(from: "evaluation" | "error" | "gameplay"): void {
    this.emit({ kind: "redraw_requested", levelId: this.level?.levelId ?? "?", from });
  }
}

export { DecisionError };
