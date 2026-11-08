// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { HttpBatchSink } from "@/src/events/http-batch-sink";
import type { EnvelopedEvent } from "@/src/domain/events";

describe("HttpBatchSink without window/document/localStorage (SSR / static export build)", () => {
  it("constructs, queues and flushes using only injected fetch", async () => {
    const f = vi.fn(async () => new Response(null, { status: 204 }));
    const sink = new HttpBatchSink({ endpoint: "https://logs.example/i", fetchImpl: f as unknown as typeof fetch });
    sink.write({ kind: "gameplay_retry", levelId: "L", eventId: "1" } as EnvelopedEvent);
    await sink.flush();
    expect(f).toHaveBeenCalledTimes(1);
    expect(sink.stats().sent).toBe(1);
    sink.dispose();
  });
});
