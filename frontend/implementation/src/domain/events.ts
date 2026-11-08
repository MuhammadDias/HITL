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
  /** Student asked for ANOTHER object while the first stays in the world (not a recovery/Redraw). */
  | { kind: "another_object_requested"; levelId: string }
  /** Student restarted the run from the checkpoint after a failure (same objects). */
  | { kind: "gameplay_retry"; levelId: string }
  /** Student picked an already-placed object up again to move it. */
  | { kind: "object_repositioned"; levelId: string }
  | { kind: "provider_error"; levelId: string; reason: string };

/** Partner-side logging backend will implement this seam later. */
export interface InteractionEventSink {
  emit(event: InteractionEvent): void;
}

/** All event kinds, kept in sync with `InteractionEvent` by the compiler (see events.test). */
export const INTERACTION_EVENT_KINDS = [
  "drawing_submitted",
  "prediction_displayed",
  "decision_made",
  "redraw_requested",
  "gameplay_result",
  "cycle_completed",
  "another_object_requested",
  "gameplay_retry",
  "object_repositioned",
  "provider_error",
] as const satisfies ReadonlyArray<InteractionEvent["kind"]>;

/** Schema marker for the DRAFT envelope below. Partner has NOT agreed to any event schema. */
export const EVENT_SCHEMA_VERSION = "draft-0" as const;

/**
 * DRAFT / PROPOSED common envelope, added by the wrapping sink
 * (src/events/envelope-sink.ts), never by call sites.
 *
 * PII minimisation: the envelope carries NO stroke/drawing payload and, by
 * default, NO student number. `studentNumber` exists only behind the explicit
 * opt-in flag NEXT_PUBLIC_EVENT_INCLUDE_STUDENT_NUMBER=1 (default OFF) because
 * it identifies an individual student and no consent/PII policy, retention rule
 * or authorised recipient has been agreed with the partner.
 */
export interface EventEnvelope {
  /** UUID v4, unique per event; also the idempotency/dedup key for at-least-once delivery. */
  eventId: string;
  /** Client clock, ISO-8601 UTC. Not trusted for ordering across devices. */
  ts: string;
  /** Per browser tab session (sessionStorage); NOT a person identifier. */
  sessionId: string;
  /** One draw -> decide cycle; starts at `drawing_submitted`. Absent before the first drawing. */
  attemptId?: string;
  schemaVersion: typeof EVENT_SCHEMA_VERSION;
  /** "mock" = DEV fixtures, "partner" = the partner adapter is the configured provider. */
  providerMode: "mock" | "partner";
  /** Reported by the partner (X-Model-Version / body.modelVersion) when available. */
  modelVersion?: string;
  /** OPT-IN ONLY (default OFF). See PII note above. */
  studentNumber?: string;
}

/** What downstream sinks receive: the raw event flattened together with the envelope. */
export type EnvelopedEvent = InteractionEvent & EventEnvelope;

/** Downstream sink for enveloped events (console, ring buffer, HTTP batch...). Must never throw. */
export interface EnvelopedEventSink {
  write(event: EnvelopedEvent): void;
  /** Best-effort delivery of anything queued. Resolves even on failure. */
  flush?(): Promise<void>;
  /** Detach listeners/timers. Idempotent. */
  dispose?(): void;
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
