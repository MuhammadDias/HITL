// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { INTERACTION_EVENT_KINDS, type EnvelopedEvent, type InteractionEvent } from "@/src/domain/events";
import { createAttemptContext } from "@/src/events/attempt-context";
import { createEnvelopeSink, sanitizeEvent } from "@/src/events/envelope-sink";
import { RingBufferSink } from "@/src/events/ring-buffer-sink";
import { createConsoleSink } from "@/src/events/console-sink";
import { createEventSink } from "@/src/events";
import { newId } from "@/src/events/ids";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function make(over: Partial<Parameters<typeof createEnvelopeSink>[0]> = {}) {
  const buffer = new RingBufferSink(50);
  let n = 0;
  const attempt = createAttemptContext(() => `att-${++n}`);
  const sink = createEnvelopeSink({
    sinks: [buffer],
    sessionId: "sess-1",
    attempt,
    providerMode: () => "mock",
    now: () => new Date("2026-11-04T10:00:00.000Z"),
    ...over,
  });
  return { buffer, attempt, sink };
}

beforeEach(() => {
  vi.spyOn(console, "info").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  try {
    localStorage.clear();
    sessionStorage.clear();
  } catch {
    /* ignore */
  }
});

describe("envelope sink", () => {
  it("adds eventId/ts/sessionId/schemaVersion/providerMode and keeps the raw payload", () => {
    const { buffer, sink } = make();
    sink.emit({ kind: "gameplay_retry", levelId: "L1" });
    const e = buffer.last()!;
    expect(e).toMatchObject({
      kind: "gameplay_retry",
      levelId: "L1",
      ts: "2026-11-04T10:00:00.000Z",
      sessionId: "sess-1",
      schemaVersion: "draft-0",
      providerMode: "mock",
    });
    expect(e.eventId).toMatch(UUID);
    expect(e.attemptId).toBeUndefined();
    expect(e.modelVersion).toBeUndefined();
    expect("studentNumber" in e).toBe(false);
  });

  it("eventIds are unique", () => {
    expect(new Set(Array.from({ length: 200 }, () => newId())).size).toBe(200);
  });

  it("starts a new attemptId on drawing_submitted (carried by that very event) and keeps it until the next drawing", () => {
    const { buffer, sink } = make();
    sink.emit({ kind: "redraw_requested", levelId: "L", from: "error" });
    sink.emit({ kind: "drawing_submitted", levelId: "L" });
    sink.emit({ kind: "prediction_displayed", levelId: "L", labels: ["a", "b", "c"] });
    sink.emit({ kind: "drawing_submitted", levelId: "L" });
    const ids = buffer.snapshot().map((e) => e.attemptId);
    expect(ids).toEqual([undefined, "att-1", "att-1", "att-2"]);
  });

  it("modelVersion/providerMode come from provenance noted for the current attempt only", () => {
    const { buffer, sink, attempt } = make();
    sink.emit({ kind: "drawing_submitted", levelId: "L" });
    attempt.noteProvenance({ mode: "partner", modelVersion: "m-7" });
    sink.emit({ kind: "prediction_displayed", levelId: "L", labels: [] });
    sink.emit({ kind: "drawing_submitted", levelId: "L" }); // new attempt clears modelVersion
    const [a, b, c] = buffer.snapshot();
    expect(a!.modelVersion).toBeUndefined();
    expect(b).toMatchObject({ modelVersion: "m-7", providerMode: "partner" });
    expect(c!.modelVersion).toBeUndefined();
  });

  it("covers every event kind", () => {
    const { buffer, sink } = make();
    const samples: Record<(typeof INTERACTION_EVENT_KINDS)[number], InteractionEvent> = {
      drawing_submitted: { kind: "drawing_submitted", levelId: "L" },
      prediction_displayed: { kind: "prediction_displayed", levelId: "L", labels: ["a", "b", "c"] },
      decision_made: { kind: "decision_made", levelId: "L", decisionType: "correct", sourceRank: 2, finalLabel: "b" },
      redraw_requested: { kind: "redraw_requested", levelId: "L", from: "gameplay" },
      gameplay_result: { kind: "gameplay_result", levelId: "L", outcome: "fail", behavior: "unresolved" },
      cycle_completed: { kind: "cycle_completed", levelId: "L", cyclesUsed: 2 },
      another_object_requested: { kind: "another_object_requested", levelId: "L" },
      gameplay_retry: { kind: "gameplay_retry", levelId: "L" },
      object_repositioned: { kind: "object_repositioned", levelId: "L" },
      provider_error: { kind: "provider_error", levelId: "L", reason: "timeout" },
    };
    for (const k of INTERACTION_EVENT_KINDS) sink.emit(samples[k]);
    expect(buffer.snapshot().map((e) => e.kind)).toEqual([...INTERACTION_EVENT_KINDS]);
  });
});

describe("PII minimisation", () => {
  it("strips stroke/drawing payloads and spoofed envelope/student fields even if a caller sneaks them in", () => {
    const { buffer, sink } = make();
    const evil = {
      kind: "drawing_submitted",
      levelId: "L",
      strokes: [[{ x: 1, y: 2 }]],
      drawing: { strokes: [] },
      drawingInput: {},
      studentNumber: "123456",
      eventId: "spoof",
      sessionId: "spoof",
    } as unknown as InteractionEvent;
    sink.emit(evil);
    const e = buffer.last() as unknown as Record<string, unknown>;
    for (const k of ["strokes", "drawing", "drawingInput", "studentNumber"]) expect(k in e).toBe(false);
    expect(e.eventId).not.toBe("spoof");
    expect(e.sessionId).toBe("sess-1");
  });

  it("caps oversized strings and arrays", () => {
    const s = sanitizeEvent({ kind: "provider_error", levelId: "L", reason: "x".repeat(5000) });
    expect((s as { reason: string }).reason).toHaveLength(200);
    const p = sanitizeEvent({ kind: "prediction_displayed", levelId: "L", labels: Array.from({ length: 50 }, (_, i) => `l${i}`) });
    expect((p as { labels: string[] }).labels).toHaveLength(10);
  });

  it("studentNumber is OFF by default even when the app stored one", () => {
    localStorage.setItem("sketchbook.studentNumber", "17");
    const { buffer, sink } = make();
    sink.emit({ kind: "gameplay_retry", levelId: "L" });
    expect("studentNumber" in buffer.last()!).toBe(false);
  });

  it("studentNumber only appears with the explicit flag, is validated, and is read from the app's storage key", () => {
    localStorage.setItem("sketchbook.studentNumber", " 17 ");
    const { buffer, sink } = make({ includeStudentNumber: true });
    sink.emit({ kind: "gameplay_retry", levelId: "L" });
    expect(buffer.last()!.studentNumber).toBe("17");
    const bad = make({ includeStudentNumber: true, getStudentNumber: () => "<script>" });
    bad.sink.emit({ kind: "gameplay_retry", levelId: "L" });
    expect("studentNumber" in bad.buffer.last()!).toBe(false);
  });

  it("createEventSink() never includes studentNumber unless NEXT_PUBLIC_EVENT_INCLUDE_STUDENT_NUMBER=1", () => {
    localStorage.setItem("sketchbook.studentNumber", "17");
    const off = createEventSink({ buffer: true, attempt: createAttemptContext(), sessionId: "s" });
    off.emit({ kind: "gameplay_retry", levelId: "L" });
    expect("studentNumber" in off.buffer!.last()!).toBe(false);
    vi.stubEnv("NEXT_PUBLIC_EVENT_INCLUDE_STUDENT_NUMBER", "1");
    const on = createEventSink({ buffer: true, attempt: createAttemptContext(), sessionId: "s" });
    on.emit({ kind: "gameplay_retry", levelId: "L" });
    expect(on.buffer!.last()!.studentNumber).toBe("17");
  });
});

describe("robustness", () => {
  it("a throwing downstream sink never reaches the caller nor starves other sinks", () => {
    const buffer = new RingBufferSink();
    const { sink } = make({
      sinks: [
        {
          write() {
            throw new Error("boom");
          },
        },
        buffer,
      ],
    });
    expect(() => sink.emit({ kind: "gameplay_retry", levelId: "L" })).not.toThrow();
    expect(buffer.size).toBe(1);
  });

  it("flush/dispose fan out and swallow errors", async () => {
    const calls: string[] = [];
    const { sink } = make({
      sinks: [
        { write() {}, flush: async () => { calls.push("flush"); throw new Error("x"); }, dispose: () => { calls.push("dispose"); throw new Error("y"); } },
      ],
    });
    await expect(sink.flush()).resolves.toBeUndefined();
    expect(() => sink.dispose()).not.toThrow();
    expect(calls).toEqual(["flush", "dispose"]);
  });
});

describe("ring buffer", () => {
  it("keeps the newest N events and counts evictions", () => {
    const rb = new RingBufferSink(3);
    for (let i = 0; i < 5; i++) rb.write({ kind: "gameplay_retry", levelId: String(i) } as EnvelopedEvent);
    expect(rb.snapshot().map((e) => (e as { levelId: string }).levelId)).toEqual(["2", "3", "4"]);
    expect(rb.evicted).toBe(2);
    rb.clear();
    expect(rb.size).toBe(0);
    expect(() => new RingBufferSink(0)).toThrow();
  });
});

describe("console sink and createEventSink gating", () => {
  it("console sink logs through the injected logger", () => {
    const log = vi.fn();
    createConsoleSink(log).write({ kind: "gameplay_retry", levelId: "L" } as EnvelopedEvent);
    expect(log).toHaveBeenCalledWith("[event-sink:DEV]", "gameplay_retry", expect.anything());
  });

  it("console output is on in non-production builds and OFF in production unless NEXT_PUBLIC_EVENT_CONSOLE=1", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_EVENT_CONSOLE", "");
    const prod = createEventSink({ attempt: createAttemptContext(), sessionId: "s" });
    prod.emit({ kind: "gameplay_retry", levelId: "L" });
    expect(info).not.toHaveBeenCalled();
    vi.stubEnv("NEXT_PUBLIC_EVENT_CONSOLE", "1");
    createEventSink({ attempt: createAttemptContext(), sessionId: "s" }).emit({ kind: "gameplay_retry", levelId: "L" });
    expect(info).toHaveBeenCalledTimes(1);
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_EVENT_CONSOLE", "");
    createEventSink({ attempt: createAttemptContext(), sessionId: "s" }).emit({ kind: "gameplay_retry", levelId: "L" });
    expect(info).toHaveBeenCalledTimes(2);
  });

  it("HTTP sink is disabled when NEXT_PUBLIC_EVENT_ENDPOINT is unset/invalid: nothing is sent", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    try {
      for (const ep of ["", "not-a-url", "ftp://x"]) {
        vi.stubEnv("NEXT_PUBLIC_EVENT_ENDPOINT", ep);
        const h = createEventSink({ attempt: createAttemptContext(), sessionId: "s" });
        expect(h.httpEnabled).toBe(false);
        h.emit({ kind: "gameplay_retry", levelId: "L" });
        await h.flush();
        expect(h.stats()).toBeUndefined();
      }
      expect(f).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("HTTP sink is enabled by a valid endpoint and delivers a batch on flush", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const f = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", f);
    vi.stubEnv("NEXT_PUBLIC_EVENT_ENDPOINT", "https://logs.example/ingest");
    try {
      const h = createEventSink({ attempt: createAttemptContext(), sessionId: "s" });
      expect(h.httpEnabled).toBe(true);
      h.emit({ kind: "gameplay_retry", levelId: "L" });
      await h.flush();
      expect(f).toHaveBeenCalledTimes(1);
      const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
      expect(url).toBe("https://logs.example/ingest");
      const body = JSON.parse(init.body as string);
      expect(body.schemaVersion).toBe("draft-0");
      expect(body.events[0]).toMatchObject({ kind: "gameplay_retry", sessionId: "s", providerMode: "mock" });
      expect(h.stats()).toMatchObject({ sent: 1, queued: 0 });
      h.dispose();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("ring buffer only when test hooks (or option) are on", () => {
    vi.stubEnv("NEXT_PUBLIC_TEST_HOOKS", "");
    expect(createEventSink({ attempt: createAttemptContext(), sessionId: "s" }).buffer).toBeUndefined();
    vi.stubEnv("NEXT_PUBLIC_TEST_HOOKS", "1");
    expect(createEventSink({ attempt: createAttemptContext(), sessionId: "s" }).buffer).toBeInstanceOf(RingBufferSink);
  });

  it("session id is stable per tab via sessionStorage", async () => {
    const { getOrCreateSessionId } = await import("@/src/events/ids");
    const a = getOrCreateSessionId();
    expect(a).toMatch(UUID);
    expect(getOrCreateSessionId()).toBe(a);
  });
});
