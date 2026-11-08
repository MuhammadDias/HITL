import {
  EVENT_SCHEMA_VERSION,
  type EnvelopedEvent,
  type EnvelopedEventSink,
  type InteractionEvent,
  type InteractionEventSink,
} from "../domain/events";
import type { AttemptContext } from "./attempt-context";
import { newId } from "./ids";

/** Keys that must never travel in an event, even if a future call site adds them (PII/payload minimisation). */
const FORBIDDEN_KEYS = new Set([
  "strokes",
  "drawing",
  "drawingInput",
  "points",
  "image",
  "raster",
  "studentNumber",
  "eventId",
  "ts",
  "sessionId",
  "attemptId",
  "schemaVersion",
  "providerMode",
  "modelVersion",
]);
const MAX_STRING = 200;
const MAX_ARRAY = 10;

function cleanValue(v: unknown): unknown {
  if (typeof v === "string") return v.length > MAX_STRING ? v.slice(0, MAX_STRING) : v;
  if (Array.isArray(v)) return v.slice(0, MAX_ARRAY).map(cleanValue);
  return v;
}

/** Shallow, defensive copy: drop forbidden keys, cap string/array sizes. */
export function sanitizeEvent(event: InteractionEvent): InteractionEvent {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(event as unknown as Record<string, unknown>)) {
    if (FORBIDDEN_KEYS.has(k)) continue;
    out[k] = cleanValue(v);
  }
  return out as unknown as InteractionEvent;
}

const STUDENT_NUMBER_RE = /^[0-9A-Za-z_-]{1,32}$/;

export function readStudentNumberFromStorage(): string | undefined {
  try {
    return window.localStorage.getItem("sketchbook.studentNumber") ?? undefined;
  } catch {
    return undefined;
  }
}

export interface EnvelopeSinkOptions {
  sinks: EnvelopedEventSink[];
  sessionId: string;
  attempt: AttemptContext;
  /** Configured provider mode (env). The provider's own reported mode wins when known. */
  providerMode: () => "mock" | "partner";
  /** OPT-IN, default false. Reason: see EventEnvelope in src/domain/events.ts. */
  includeStudentNumber?: boolean;
  /** Only consulted when includeStudentNumber is true. */
  getStudentNumber?: () => string | undefined;
  now?: () => Date;
  makeId?: () => string;
}

export interface EnvelopeSink extends InteractionEventSink {
  flush(): Promise<void>;
  dispose(): void;
}

/**
 * Wraps downstream sinks: adds the DRAFT common envelope to each raw
 * InteractionEvent. Never throws into the caller (UI/state machine).
 */
export function createEnvelopeSink(options: EnvelopeSinkOptions): EnvelopeSink {
  const now = options.now ?? (() => new Date());
  const makeId = options.makeId ?? newId;
  return {
    emit(event) {
      try {
        // A new draw starts a new attempt; do it BEFORE stamping so the event carries the new id.
        if (event.kind === "drawing_submitted") options.attempt.begin();
        const envelope: Record<string, unknown> = {
          eventId: makeId(),
          ts: now().toISOString(),
          sessionId: options.sessionId,
          schemaVersion: EVENT_SCHEMA_VERSION,
          providerMode: options.attempt.providerMode() ?? options.providerMode(),
        };
        const attemptId = options.attempt.current();
        if (attemptId) envelope.attemptId = attemptId;
        const modelVersion = options.attempt.modelVersion();
        if (modelVersion) envelope.modelVersion = modelVersion;
        if (options.includeStudentNumber) {
          const raw = options.getStudentNumber?.() ?? readStudentNumberFromStorage();
          const sn = typeof raw === "string" ? raw.trim() : "";
          if (STUDENT_NUMBER_RE.test(sn)) envelope.studentNumber = sn;
        }
        const enveloped = { ...sanitizeEvent(event), ...envelope } as EnvelopedEvent;
        for (const sink of options.sinks) {
          try {
            sink.write(enveloped);
          } catch {
            /* one broken sink must not affect the others or the UI */
          }
        }
      } catch {
        /* telemetry must never break the app */
      }
    },
    async flush() {
      await Promise.all(
        options.sinks.map((s) => (s.flush ? s.flush().catch(() => undefined) : Promise.resolve())),
      );
    },
    dispose() {
      for (const s of options.sinks) {
        try {
          s.dispose?.();
        } catch {
          /* ignore */
        }
      }
    },
  };
}
