import type { EnvelopedEventSink, InteractionEventSink } from "../domain/events";
import { env } from "../config/env";
import { attemptContext, type AttemptContext } from "./attempt-context";
import { createConsoleSink } from "./console-sink";
import { createEnvelopeSink, type EnvelopeSink } from "./envelope-sink";
import { HttpBatchSink, type HttpBatchSinkStats } from "./http-batch-sink";
import { getOrCreateSessionId } from "./ids";
import { RingBufferSink } from "./ring-buffer-sink";

export * from "./attempt-context";
export * from "./console-sink";
export * from "./envelope-sink";
export * from "./http-batch-sink";
export * from "./ids";
export * from "./ring-buffer-sink";

export interface EventSinkHandle extends InteractionEventSink {
  flush(): Promise<void>;
  dispose(): void;
  /** True when NEXT_PUBLIC_EVENT_ENDPOINT is a valid http(s) URL and the HTTP sink is active. */
  readonly httpEnabled: boolean;
  /** Present only when NEXT_PUBLIC_TEST_HOOKS=1 (or options.buffer): in-memory events for tests/E2E. */
  readonly buffer?: RingBufferSink;
  stats(): HttpBatchSinkStats | undefined;
}

export interface CreateEventSinkOptions {
  /** Force the ring buffer on/off. Default: on only when env.testHooksEnabled. */
  buffer?: boolean;
  /** Extra downstream sinks (tests, future transports). */
  extraSinks?: EnvelopedEventSink[];
  attempt?: AttemptContext;
  sessionId?: string;
}

/**
 * Builds the app's InteractionEventSink from env (read via src/config/env.ts):
 *   NEXT_PUBLIC_EVENT_ENDPOINT                 unset/invalid => HTTP sink OFF => nothing is sent
 *   NEXT_PUBLIC_EVENT_CONSOLE=1                console sink in production too (default: DEV builds only)
 *   NEXT_PUBLIC_EVENT_INCLUDE_STUDENT_NUMBER=1 OPT-IN studentNumber in envelope (default OFF)
 *   NEXT_PUBLIC_EVENT_BATCH_SIZE / _FLUSH_INTERVAL_MS
 * Never throws.
 */
export function createEventSink(options: CreateEventSinkOptions = {}): EventSinkHandle {
  const downstream: EnvelopedEventSink[] = [];
  let http: HttpBatchSink | undefined;
  let buffer: RingBufferSink | undefined;
  try {
    if (env.isDevBuild || env.eventConsoleEnabled) downstream.push(createConsoleSink());
    if (options.buffer ?? env.testHooksEnabled) {
      buffer = new RingBufferSink();
      downstream.push(buffer);
    }
    const endpoint = env.eventEndpoint;
    if (/^https?:\/\//i.test(endpoint)) {
      http = new HttpBatchSink({
        endpoint,
        batchSize: env.eventBatchSize,
        flushIntervalMs: env.eventFlushIntervalMs,
      });
      downstream.push(http);
    } else if (endpoint && env.isDevBuild) {
      // eslint-disable-next-line no-console
      console.warn("[event-sink] NEXT_PUBLIC_EVENT_ENDPOINT is not an http(s) URL; HTTP sink disabled.");
    }
  } catch {
    /* fall through with whatever was built */
  }
  downstream.push(...(options.extraSinks ?? []));

  const envelope: EnvelopeSink = createEnvelopeSink({
    sinks: downstream,
    sessionId: options.sessionId ?? getOrCreateSessionId(),
    attempt: options.attempt ?? attemptContext,
    providerMode: () => env.predictionMode,
    includeStudentNumber: env.eventIncludeStudentNumber,
  });

  return {
    emit: (event) => envelope.emit(event),
    flush: () => envelope.flush(),
    dispose: () => envelope.dispose(),
    httpEnabled: http !== undefined,
    buffer,
    stats: () => http?.stats(),
  };
}
