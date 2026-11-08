// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EnvelopedEvent } from "@/src/domain/events";
import { HttpBatchSink, type StorageLike } from "@/src/events/http-batch-sink";

// Everything below uses FAKE fetch / fake localStorage / fake timers. No real backend exists (NOT TESTED against one).
const EP = "https://logs.example/ingest";
const KEY = "skb.events.queue.v0";

let seq = 0;
function ev(over: Partial<EnvelopedEvent> = {}): EnvelopedEvent {
  seq++;
  return {
    kind: "gameplay_retry",
    levelId: "L",
    eventId: `e-${seq}`,
    ts: "2026-11-04T10:00:00.000Z",
    sessionId: "s",
    schemaVersion: "draft-0",
    providerMode: "mock",
    ...over,
  } as EnvelopedEvent;
}

class FakeStorage implements StorageLike {
  map = new Map<string, string>();
  failSet = false;
  getItem(k: string) {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    if (this.failSet) throw new DOMException("quota", "QuotaExceededError");
    this.map.set(k, v);
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
}

type FetchFn = ReturnType<typeof vi.fn>;
function fakeFetch(...statuses: Array<number | "network">): FetchFn {
  let i = 0;
  return vi.fn(async (_u: unknown, _init?: RequestInit) => {
    const s = statuses[Math.min(i++, statuses.length - 1)]!;
    if (s === "network") throw new TypeError("Failed to fetch");
    return new Response(s === 204 ? null : "x", { status: s });
  });
}
function sentEvents(f: FetchFn, call = 0): EnvelopedEvent[] {
  return JSON.parse(((f.mock.calls[call] as unknown[])[1] as RequestInit).body as string).events;
}
function make(f: FetchFn, storage: StorageLike | null, over: Partial<ConstructorParameters<typeof HttpBatchSink>[0]> = {}) {
  return new HttpBatchSink({
    endpoint: EP,
    fetchImpl: f as unknown as typeof fetch,
    storage,
    sendBeaconImpl: undefined,
    random: () => 0,
    now: () => new Date("2026-11-04T10:00:05.000Z"),
    flushIntervalMs: 5000,
    batchSize: 3,
    ...over,
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  seq = 0;
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("HttpBatchSink: batching", () => {
  it("sends nothing before the interval, then one POST with the batch envelope", async () => {
    const f = fakeFetch(204);
    const sink = make(f, null);
    sink.write(ev());
    sink.write(ev());
    await vi.advanceTimersByTimeAsync(4999);
    expect(f).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(2);
    expect(f).toHaveBeenCalledTimes(1);
    const [url, init] = f.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(EP);
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("omit");
    expect((init.headers as Record<string, string>)["content-type"]).toBe("application/json");
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({ schemaVersion: "draft-0", sentAt: "2026-11-04T10:00:05.000Z" });
    expect(body.events.map((e: EnvelopedEvent) => e.eventId)).toEqual(["e-1", "e-2"]);
    expect(sink.stats()).toMatchObject({ sent: 2, queued: 0 });
  });

  it("a full batch flushes immediately and large backlogs go out in batchSize chunks", async () => {
    const f = fakeFetch(204);
    const sink = make(f, null);
    for (let i = 0; i < 7; i++) sink.write(ev());
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(10);
    expect(f.mock.calls.length).toBeGreaterThanOrEqual(2);
    await sink.flush();
    expect(f.mock.calls.map((_, i) => sentEvents(f, i).length)).toEqual([3, 3, 1]);
    expect(sink.stats().sent).toBe(7);
  });

  it("flush() drains everything on demand", async () => {
    const f = fakeFetch(204);
    const sink = make(f, null);
    sink.write(ev());
    await sink.flush();
    expect(f).toHaveBeenCalledTimes(1);
  });
});

describe("HttpBatchSink: retry/backoff", () => {
  it("retries 5xx with exponential backoff (1s, 2s) and then succeeds; counters add up", async () => {
    const f = fakeFetch(503, 503, 204);
    const storage = new FakeStorage();
    const sink = make(f, storage);
    sink.write(ev());
    await vi.advanceTimersByTimeAsync(5000); // first attempt
    expect(f).toHaveBeenCalledTimes(1);
    expect(storage.map.has(KEY)).toBe(true); // persisted on failure
    await vi.advanceTimersByTimeAsync(999);
    expect(f).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(2); // +1000 backoff
    expect(f).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1990);
    expect(f).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(20); // +2000 backoff after the 2nd failure
    expect(f).toHaveBeenCalledTimes(3);
    expect(sink.stats()).toMatchObject({ sent: 1, queued: 0, failedAttempts: 2, dropped: 0 });
    expect(storage.map.has(KEY)).toBe(false); // persisted copy removed after success
  });

  it("backoff is capped at maxBackoffMs", async () => {
    const f = fakeFetch(503);
    const sink = make(f, null, { baseBackoffMs: 1000, maxBackoffMs: 3000 });
    sink.write(ev());
    await vi.advanceTimersByTimeAsync(5000); // attempt 1
    await vi.advanceTimersByTimeAsync(1000); // attempt 2
    await vi.advanceTimersByTimeAsync(2000); // attempt 3
    await vi.advanceTimersByTimeAsync(3000); // attempt 4 (capped, would be 4000)
    await vi.advanceTimersByTimeAsync(3000); // attempt 5 (capped)
    expect(f).toHaveBeenCalledTimes(5);
    sink.dispose();
  });

  it("network errors, 408 and 429 are retried", async () => {
    for (const first of ["network", 408, 429] as const) {
      const f = fakeFetch(first, 204);
      const sink = make(f, null);
      sink.write(ev());
      await vi.advanceTimersByTimeAsync(5000);
      await vi.advanceTimersByTimeAsync(1000);
      expect(f).toHaveBeenCalledTimes(2);
      expect(sink.stats().sent).toBe(1);
      sink.dispose();
    }
  });

  it("permanent 4xx drops the batch (counted as rejected) instead of retrying forever", async () => {
    const f = fakeFetch(400);
    const sink = make(f, null);
    sink.write(ev());
    sink.write(ev());
    await vi.advanceTimersByTimeAsync(60_000);
    expect(f).toHaveBeenCalledTimes(1);
    expect(sink.stats()).toMatchObject({ rejected: 2, sent: 0, queued: 0 });
  });

  it("a hanging request is aborted after requestTimeoutMs and retried", async () => {
    const f = vi.fn((_u: unknown, init?: RequestInit) => new Promise<Response>((_r, rej) => init!.signal!.addEventListener("abort", () => rej(new DOMException("a", "AbortError")))));
    const sink = make(f, null, { requestTimeoutMs: 2000 });
    sink.write(ev());
    await vi.advanceTimersByTimeAsync(5000);
    await vi.advanceTimersByTimeAsync(2001);
    expect(sink.stats()).toMatchObject({ failedAttempts: 1, queued: 1 });
    sink.dispose();
  });

  it("new writes during backoff do not pull the retry earlier", async () => {
    const f = fakeFetch(503, 204);
    const sink = make(f, null);
    sink.write(ev());
    await vi.advanceTimersByTimeAsync(5000);
    expect(f).toHaveBeenCalledTimes(1);
    sink.write(ev());
    await vi.advanceTimersByTimeAsync(500);
    expect(f).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(600);
    expect(f).toHaveBeenCalledTimes(2);
    expect(sentEvents(f, 1)).toHaveLength(2);
  });
});

describe("HttpBatchSink: bounded queue and storage cap", () => {
  it("drops OLDEST events and counts them when maxQueue is hit", async () => {
    const f = fakeFetch(204);
    const sink = make(f, null, { maxQueue: 4, batchSize: 100 });
    for (let i = 0; i < 6; i++) sink.write(ev());
    expect(sink.stats()).toMatchObject({ queued: 4, dropped: 2 });
    await sink.flush();
    expect(sentEvents(f).map((e) => e.eventId)).toEqual(["e-3", "e-4", "e-5", "e-6"]);
  });

  it("persisted copy respects maxStorageChars (oldest trimmed, counted)", async () => {
    const f = fakeFetch(503);
    const storage = new FakeStorage();
    const sink = make(f, storage, { maxStorageChars: 700, batchSize: 100 });
    for (let i = 0; i < 10; i++) sink.write(ev());
    await vi.advanceTimersByTimeAsync(5000);
    const raw = storage.map.get(KEY)!;
    expect(raw.length).toBeLessThanOrEqual(700);
    const persisted = JSON.parse(raw).events as EnvelopedEvent[];
    expect(persisted.length).toBeGreaterThan(0);
    expect(persisted.length).toBeLessThan(10);
    expect(persisted[persisted.length - 1]!.eventId).toBe("e-10"); // newest kept
    expect(sink.stats().droppedFromStorage).toBe(10 - persisted.length);
    expect(sink.stats().queued).toBe(10); // memory copy is untouched
    sink.dispose();
  });

  it("storage failures (quota/blocked) never throw and do not lose in-memory events", async () => {
    const f = fakeFetch(503, 204);
    const storage = new FakeStorage();
    storage.failSet = true;
    const sink = make(f, storage);
    expect(() => sink.write(ev())).not.toThrow();
    await vi.advanceTimersByTimeAsync(5000);
    await vi.advanceTimersByTimeAsync(1000);
    expect(sink.stats().sent).toBe(1);
  });
});

describe("HttpBatchSink: offline persistence", () => {
  it("events persisted by a previous page are reloaded, deduplicated and sent", async () => {
    const storage = new FakeStorage();
    storage.setItem(KEY, JSON.stringify({ v: 1, events: [ev({ eventId: "old-1" }), ev({ eventId: "old-2" }), { junk: true }, "str"] }));
    const f = fakeFetch(204);
    const sink = make(f, storage);
    sink.write(ev({ eventId: "old-2" })); // same id as a persisted one is NOT re-queued by load; write adds it (caller dedups by eventId upstream)
    await vi.advanceTimersByTimeAsync(5000);
    const ids = sentEvents(f).map((e) => e.eventId);
    expect(ids.slice(0, 2)).toEqual(["old-1", "old-2"]);
    expect(storage.map.has(KEY)).toBe(false);
  });

  it("corrupted storage is discarded without throwing", () => {
    const storage = new FakeStorage();
    storage.setItem(KEY, "{not json");
    expect(() => make(fakeFetch(204), storage)).not.toThrow();
    expect(storage.map.has(KEY)).toBe(false);
  });

  it("while offline nothing is sent (events persisted); the online event triggers delivery", async () => {
    const f = fakeFetch(204);
    const storage = new FakeStorage();
    const online = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    const sink = make(f, storage);
    sink.write(ev());
    await vi.advanceTimersByTimeAsync(10_000);
    expect(f).not.toHaveBeenCalled();
    expect(storage.map.has(KEY)).toBe(true);
    online.mockReturnValue(true);
    window.dispatchEvent(new Event("online"));
    await vi.advanceTimersByTimeAsync(0);
    expect(f).toHaveBeenCalledTimes(1);
    expect(sink.stats().sent).toBe(1);
    sink.dispose();
  });
});

describe("HttpBatchSink: page lifecycle", () => {
  function hidden(state: "hidden" | "visible") {
    vi.spyOn(document, "visibilityState", "get").mockReturnValue(state);
    document.dispatchEvent(new Event("visibilitychange"));
  }

  it("pagehide: sendBeacon accepts => queue emptied and persisted copy removed", () => {
    const beacon = vi.fn((_u: string, _b: Blob) => true);
    const f = fakeFetch(204);
    const storage = new FakeStorage();
    const sink = make(f, storage, { sendBeaconImpl: beacon });
    sink.write(ev());
    sink.write(ev());
    window.dispatchEvent(new Event("pagehide"));
    expect(beacon).toHaveBeenCalledTimes(1);
    expect(beacon.mock.calls[0]![0]).toBe(EP);
    expect(beacon.mock.calls[0]![1].type).toBe("application/json");
    expect(f).not.toHaveBeenCalled();
    expect(sink.stats()).toMatchObject({ queued: 0, sent: 2 });
    expect(storage.map.has(KEY)).toBe(false);
    sink.dispose();
  });

  it("pagehide: beacon refused => fetch keepalive fallback; persisted copy kept (at-least-once, dedup by eventId)", () => {
    const beacon = vi.fn(() => false);
    const f = fakeFetch(204);
    const storage = new FakeStorage();
    const sink = make(f, storage, { sendBeaconImpl: beacon });
    sink.write(ev());
    window.dispatchEvent(new Event("pagehide"));
    expect(beacon).toHaveBeenCalledTimes(1);
    expect(f).toHaveBeenCalledTimes(1);
    expect((f.mock.calls[0]![1] as RequestInit).keepalive).toBe(true);
    expect(storage.map.has(KEY)).toBe(true);
    expect(JSON.parse(storage.map.get(KEY)!).events).toHaveLength(1);
    sink.dispose();
  });

  it("pagehide with no beacon support uses fetch keepalive; beacon that throws also falls back", () => {
    const f = fakeFetch(204);
    const sink = make(f, null, {
      sendBeaconImpl: () => {
        throw new Error("nope");
      },
    });
    sink.write(ev());
    window.dispatchEvent(new Event("pagehide"));
    expect(f).toHaveBeenCalledTimes(1);
    sink.dispose();
  });

  it("visibilitychange:hidden flushes; visible does not", () => {
    const beacon = vi.fn(() => true);
    const sink = make(fakeFetch(204), null, { sendBeaconImpl: beacon });
    sink.write(ev());
    hidden("visible");
    expect(beacon).not.toHaveBeenCalled();
    hidden("hidden");
    expect(beacon).toHaveBeenCalledTimes(1);
    sink.dispose();
  });

  it("when both beacon and fetch are unavailable the events stay queued and persisted", () => {
    const storage = new FakeStorage();
    vi.stubGlobal("fetch", undefined);
    try {
      const sink = new HttpBatchSink({ endpoint: EP, storage, sendBeaconImpl: undefined, batchSize: 3 });
      sink.write(ev());
      window.dispatchEvent(new Event("pagehide"));
      expect(sink.stats().queued).toBe(1);
      expect(JSON.parse(storage.map.get(KEY)!).events).toHaveLength(1);
      sink.dispose();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("dispose() detaches listeners and persists the remainder; later writes are ignored", () => {
    const beacon = vi.fn(() => true);
    const storage = new FakeStorage();
    const sink = make(fakeFetch(204), storage, { sendBeaconImpl: beacon });
    sink.write(ev());
    sink.dispose();
    expect(JSON.parse(storage.map.get(KEY)!).events).toHaveLength(1);
    window.dispatchEvent(new Event("pagehide"));
    expect(beacon).not.toHaveBeenCalled();
    sink.write(ev());
    expect(sink.stats().queued).toBe(1);
    sink.dispose(); // idempotent
  });
});

describe("HttpBatchSink: never throws into the UI", () => {
  it("synchronously throwing fetch, hostile storage and junk events are all swallowed", async () => {
    const hostile: StorageLike = {
      getItem() {
        throw new Error("blocked");
      },
      setItem() {
        throw new Error("blocked");
      },
      removeItem() {
        throw new Error("blocked");
      },
    };
    const throwingFetch = vi.fn(() => {
      throw new Error("sync boom");
    });
    const sink = make(throwingFetch, hostile);
    expect(() => sink.write(ev())).not.toThrow();
    expect(() => sink.write(null as unknown as EnvelopedEvent)).not.toThrow();
    await vi.advanceTimersByTimeAsync(6000);
    await expect(sink.flush()).resolves.toBeUndefined();
    window.dispatchEvent(new Event("pagehide"));
    expect(() => sink.dispose()).not.toThrow();
  });
});
