import { beforeEach, describe, expect, it } from "vitest";
import {
  getSharedStream,
  resetSharedStreamForTest,
  setSharedStream,
  subscribeSharedStream,
} from "../../src/camera/shared-stream";

/** t_466ea100 — the stream hand-off that keeps hand tracking on ONE camera. */
const streamA = { id: "A" } as unknown as MediaStream;
const streamB = { id: "B" } as unknown as MediaStream;

describe("shared camera stream", () => {
  beforeEach(() => resetSharedStreamForTest());

  it("starts empty", () => {
    expect(getSharedStream()).toBeNull();
  });

  it("publishes and retires the GlobalCamera stream", () => {
    setSharedStream(streamA);
    expect(getSharedStream()).toBe(streamA);
    setSharedStream(null);
    expect(getSharedStream()).toBeNull();
  });

  it("notifies subscribers on change, immediately on subscribe", () => {
    setSharedStream(streamA);
    const seen: Array<MediaStream | null> = [];
    const unsubscribe = subscribeSharedStream((stream: MediaStream | null) => seen.push(stream));
    expect(seen).toEqual([streamA]);
    setSharedStream(streamB);
    setSharedStream(null);
    expect(seen).toEqual([streamA, streamB, null]);
    unsubscribe();
    setSharedStream(streamA);
    expect(seen).toEqual([streamA, streamB, null]);
  });

  it("ignores redundant publishes (no duplicate listener churn)", () => {
    setSharedStream(streamA);
    let calls = 0;
    const unsubscribe = subscribeSharedStream(() => {
      calls += 1;
    });
    expect(calls).toBe(1);
    setSharedStream(streamA);
    expect(calls).toBe(1);
    unsubscribe();
  });
});
