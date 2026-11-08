import type { EnvelopedEvent, EnvelopedEventSink } from "../domain/events";

/** DEV console sink. The factory only enables it when NODE_ENV !== "production" or an explicit flag is set. */
export function createConsoleSink(log: (...args: unknown[]) => void = defaultLog): EnvelopedEventSink {
  return {
    write(event: EnvelopedEvent) {
      log("[event-sink:DEV]", event.kind, event);
    },
  };
}

function defaultLog(...args: unknown[]): void {
  // eslint-disable-next-line no-console
  console.info(...args);
}
