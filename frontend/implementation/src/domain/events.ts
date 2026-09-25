/**
 * FR-18: Typed interaction-event seam for future partner logging.
 * This is NOT the production event/database schema (explicitly unlocked).
 * The sink is injected at bootstrap; the dev default is console/no-op.
 */

export type InteractionEvent =
  | { kind: "drawing_submitted"; levelId: string }
  | { kind: "prediction_displayed"; levelId: string; labels: string[] }
  | { kind: "decision_made"; levelId: string; decisionType: "accept" | "correct" | "override"; sourceRank?: 1 | 2 | 3; finalLabel: string }
  | { kind: "redraw_requested"; levelId: string; from: "evaluation" | "error" | "gameplay" }
  | { kind: "gameplay_result"; levelId: string; outcome: "success" | "fail"; behavior: "solid" | "danger" | "unresolved" }
  | { kind: "cycle_completed"; levelId: string; cyclesUsed: number }
  | { kind: "provider_error"; levelId: string; reason: string };

/** Partner-side logging backend will implement this seam later. */
export interface InteractionEventSink {
  emit(event: InteractionEvent): void;
}

/** DEV sink: logs to console in dev builds only. Replaceable without UI changes. */
export function createDevConsoleSink(): InteractionEventSink {
  return {
    emit(event) {
      // eslint-disable-next-line no-console
      console.info("[event-sink:DEV]", event.kind, event);
    },
  };
}

export const noopSink: InteractionEventSink = { emit() {} };
