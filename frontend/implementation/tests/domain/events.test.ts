import { describe, expect, it } from "vitest";
import {
  EVENT_SCHEMA_VERSION,
  INTERACTION_EVENT_KINDS,
  createDevConsoleSink,
  noopSink,
  type InteractionEvent,
} from "@/src/domain/events";

// Compile-time exhaustiveness: if a new InteractionEvent kind is added and not listed, this stops compiling.
type MissingKinds = Exclude<InteractionEvent["kind"], (typeof INTERACTION_EVENT_KINDS)[number]>;
const _exhaustive: [MissingKinds] extends [never] ? true : never = true;

describe("domain events seam", () => {
  it("lists every event kind exactly once", () => {
    expect(_exhaustive).toBe(true);
    expect(new Set(INTERACTION_EVENT_KINDS).size).toBe(INTERACTION_EVENT_KINDS.length);
    expect(INTERACTION_EVENT_KINDS).toHaveLength(10);
  });

  it("schema marker is draft-0", () => {
    expect(EVENT_SCHEMA_VERSION).toBe("draft-0");
  });

  it("noop and dev console sinks keep working (backwards compatible)", () => {
    expect(() => noopSink.emit({ kind: "gameplay_retry", levelId: "L" })).not.toThrow();
    expect(typeof createDevConsoleSink().emit).toBe("function");
  });
});
