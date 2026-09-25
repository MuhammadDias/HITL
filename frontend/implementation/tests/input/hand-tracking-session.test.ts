import { beforeEach, describe, expect, it, vi } from "vitest";

const { createFromOptions, forVisionTasks } = vi.hoisted(() => ({ createFromOptions: vi.fn(), forVisionTasks: vi.fn() }));
vi.mock("@mediapipe/tasks-vision", () => ({
  FilesetResolver: { forVisionTasks },
  HandLandmarker: { createFromOptions },
}));

import { HandTrackingSession } from "@/src/input/hand-tracking-session";
import type { Landmark } from "@/src/input/types";

function hand(): Landmark[] {
  return Array.from({ length: 21 }, (_, index) => ({
    x: index === 0 || index === 9 ? 0.5 : index === 4 ? 0.48 : index === 8 ? 0.5 : 0.5,
    y: index === 0 ? 0.8 : index === 9 ? 0.6 : index === 4 || index === 8 ? 0.4 : 0.5,
  }));
}

describe("HandTrackingSession", () => {
  beforeEach(() => {
    createFromOptions.mockReset();
    forVisionTasks.mockReset();
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [] }) } });
    vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
  });

  it("publishes a lost frame immediately, which lets consumers close a stroke without a teleport", () => {
    const session = new HandTrackingSession();
    const statuses: string[] = [];
    session.subscribeStatus((status) => statuses.push(status.kind));
    session.feedLandmarksForTest(hand(), 0);
    session.feedLandmarksForTest(undefined, 16);
    expect(statuses).toContain("tracking-lost");
    expect(session.getFrame()?.gesture.state).toBe("lost");
  });

  it("filters thumb and index-tip jitter before publishing a tracking frame", () => {
    const session = new HandTrackingSession();
    const stable = hand();
    stable[4] = { x: 0.48, y: 0.4 };
    stable[8] = { x: 0.5, y: 0.4 };
    session.feedLandmarksForTest(stable, 0);

    const noisy = hand();
    noisy[4] = { x: 0.70, y: 0.4 };
    noisy[8] = { x: 0.70, y: 0.4 };
    session.feedLandmarksForTest(noisy, 16);

    const filtered = session.getFrame()?.landmarks;
    expect(filtered?.[4]?.x).toBeGreaterThan(0.48);
    expect(filtered?.[4]?.x).toBeLessThan(0.70);
    expect(filtered?.[8]?.x).toBeGreaterThan(0.5);
    expect(filtered?.[8]?.x).toBeLessThan(0.70);
  });

  it("tries the GPU delegate before a CPU fallback", async () => {
    forVisionTasks.mockResolvedValue({});
    createFromOptions
      .mockRejectedValueOnce(new Error("GPU unavailable"))
      .mockResolvedValueOnce({ detectForVideo: vi.fn(), close: vi.fn() });
    const video = { srcObject: null, readyState: 0, play: vi.fn().mockResolvedValue(undefined) } as unknown as HTMLVideoElement;
    const session = new HandTrackingSession();
    session.setVideo(video);
    await session.start();
    expect(createFromOptions).toHaveBeenCalledTimes(2);
    expect(createFromOptions.mock.calls[0]?.[1].baseOptions.delegate).toBe("GPU");
    expect(createFromOptions.mock.calls[1]?.[1].baseOptions.delegate).toBe("CPU");
    expect(createFromOptions.mock.calls[0]?.[1]).toMatchObject({
      minHandDetectionConfidence: 0.5,
      minHandPresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
    expect(session.getStatus()).toEqual({ kind: "ready" });
  });
});

describe("HandTrackingSession lifecycle races", () => {
  beforeEach(() => {
    createFromOptions.mockReset();
    forVisionTasks.mockReset();
    vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
  });

  it("does not publish ready or create a model when StrictMode cleanup stops a pending permission request", async () => {
    let resolveCamera: ((stream: { getTracks(): Array<{ stop(): void }> }) => void) | undefined;
    const lateTrack = { stop: vi.fn() };
    const pendingCamera = new Promise<{ getTracks(): Array<{ stop(): void }> }>((resolve) => { resolveCamera = resolve; });
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: vi.fn().mockReturnValue(pendingCamera) } });
    const session = new HandTrackingSession();
    session.setVideo({ srcObject: null, readyState: 0, play: vi.fn().mockResolvedValue(undefined) } as unknown as HTMLVideoElement);
    const statuses: string[] = [];
    session.subscribeStatus((status) => statuses.push(status.kind));
    const firstStart = session.start();
    await flush();
    await session.stop();
    resolveCamera?.({ getTracks: () => [lateTrack] });
    await firstStart;

    expect(lateTrack.stop).toHaveBeenCalledOnce();
    expect(forVisionTasks).not.toHaveBeenCalled();
    expect(statuses).not.toContain("ready");
    expect(session.getStatus().kind).toBe("idle");
  });

  it("closes a model that resolves after stop during initialization", async () => {
    let resolveVision: ((vision: object) => void) | undefined;
    forVisionTasks.mockReturnValue(new Promise<object>((resolve) => { resolveVision = resolve; }));
    const model = { detectForVideo: vi.fn(), close: vi.fn() };
    createFromOptions.mockResolvedValue(model);
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [] }) } });
    const session = new HandTrackingSession();
    session.setVideo({ srcObject: null, readyState: 0, play: vi.fn().mockResolvedValue(undefined) } as unknown as HTMLVideoElement);
    const statuses: string[] = [];
    session.subscribeStatus((status) => statuses.push(status.kind));
    const starting = session.start();
    await flush();
    await session.stop();
    resolveVision?.({});
    await starting;

    expect(model.close).toHaveBeenCalledOnce();
    expect(statuses).not.toContain("ready");
    expect(session.getStatus().kind).toBe("idle");
  });
});

async function flush(): Promise<void> {
  for (let i = 0; i < 6; i++) await Promise.resolve();
}

describe("HandTrackingSession restart and camera switching", () => {
  beforeEach(() => {
    createFromOptions.mockReset();
    forVisionTasks.mockReset().mockResolvedValue({});
    createFromOptions.mockResolvedValue({ detectForVideo: vi.fn(), close: vi.fn() });
    vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
  });

  it("allows a StrictMode stop/start cycle while the first camera request resolves late", async () => {
    let resolveFirst: ((stream: { getTracks(): Array<{ stop(): void }> }) => void) | undefined;
    const firstTrack = { stop: vi.fn() };
    const secondTrack = { stop: vi.fn() };
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: {
      getUserMedia: vi.fn()
        .mockReturnValueOnce(new Promise((resolve) => { resolveFirst = resolve; }))
        .mockResolvedValueOnce({ getTracks: () => [secondTrack] }),
    } });
    const session = new HandTrackingSession();
    session.setVideo({ srcObject: null, readyState: 0, play: vi.fn().mockResolvedValue(undefined) } as unknown as HTMLVideoElement);
    const first = session.start();
    await flush();
    await session.stop();
    await session.start();
    resolveFirst?.({ getTracks: () => [firstTrack] });
    await first;

    expect(firstTrack.stop).toHaveBeenCalledOnce();
    expect(session.getStatus().kind).toBe("ready");
  });

  it("tears down the old stream for a device switch and can restart after an initialization failure", async () => {
    const firstTrack = { stop: vi.fn() };
    const secondTrack = { stop: vi.fn() };
    const getUserMedia = vi.fn()
      .mockRejectedValueOnce(new DOMException("denied", "NotAllowedError"))
      .mockResolvedValueOnce({ getTracks: () => [firstTrack] })
      .mockResolvedValueOnce({ getTracks: () => [secondTrack] });
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia } });
    const session = new HandTrackingSession();
    session.setVideo({ srcObject: null, readyState: 0, play: vi.fn().mockResolvedValue(undefined) } as unknown as HTMLVideoElement);

    await session.start();
    expect(session.getStatus()).toEqual({ kind: "error", reason: "permission-denied" });
    await session.start("front");
    await session.start("rear");

    expect(firstTrack.stop).toHaveBeenCalledOnce();
    expect(getUserMedia.mock.calls[2]?.[0].video).toEqual({ deviceId: { exact: "rear" } });
    expect(session.getStatus().kind).toBe("ready");
  });
});

describe("stopped session state", () => {
  it("publishes a lost frame to current subscribers before clearing it", async () => {
    const session = new HandTrackingSession();
    const states: string[] = [];
    session.subscribeFrame((frame) => states.push(frame.gesture.state));
    session.feedLandmarksForTest(hand(), 0);
    await session.stop();

    expect(states).toHaveLength(2);
    expect(states[0]).not.toBe("lost");
    expect(states[1]).toBe("lost");
    expect(session.getFrame()).toBeNull();
  });

  it("clears the last frame on stop so a later subscriber cannot receive stale tracking", async () => {
    const session = new HandTrackingSession();
    session.feedLandmarksForTest(hand(), 0);
    await session.stop();
    const frames: unknown[] = [];
    session.subscribeFrame((frame) => frames.push(frame));
    expect(session.getFrame()).toBeNull();
    expect(frames).toEqual([]);
  });

  it("reports a missing mediaDevices API as camera-unavailable", async () => {
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: undefined });
    const session = new HandTrackingSession();
    session.setVideo({ srcObject: null, readyState: 0, play: vi.fn().mockResolvedValue(undefined) } as unknown as HTMLVideoElement);
    await session.start();
    expect(session.getStatus()).toEqual({ kind: "error", reason: "camera-unavailable" });
  });
});
