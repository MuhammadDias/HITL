// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";
import { WaveTracker, detectWave, type WaveTrackerStatus } from "@/src/camera/wave-tracker";

vi.mock("@mediapipe/tasks-vision", () => ({
  FilesetResolver: { forVisionTasks: vi.fn() },
  HandLandmarker: { createFromOptions: vi.fn() },
}));

let rafQueue: Array<{ id: number; cb: FrameRequestCallback }>;
let nextId: number;
let now: number;
const cancelled = new Set<number>();

function step() {
  const q = rafQueue.splice(0);
  for (const f of q) if (!cancelled.has(f.id)) f.cb(now);
}
const flush = () => new Promise((r) => setTimeout(r, 0));

function fakeLandmarker(detect: () => unknown) {
  return { detectForVideo: vi.fn(detect), close: vi.fn() };
}

function video(over: Partial<HTMLVideoElement> = {}) {
  return { readyState: 4, currentTime: -1, ...over } as HTMLVideoElement;
}

beforeEach(() => {
  vi.clearAllMocks();
  rafQueue = [];
  nextId = 1;
  now = 1000;
  cancelled.clear();
  vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation((cb) => {
    const id = nextId++;
    rafQueue.push({ id, cb });
    return id;
  });
  vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation((id) => {
    cancelled.add(id as number);
  });
  vi.spyOn(performance, "now").mockImplementation(() => now);
  vi.mocked(FilesetResolver.forVisionTasks).mockResolvedValue({} as never);
});

afterEach(() => vi.restoreAllMocks());

function make(lm: ReturnType<typeof fakeLandmarker>, v = video()) {
  vi.mocked(HandLandmarker.createFromOptions).mockResolvedValue(lm as never);
  const statuses: WaveTrackerStatus[] = [];
  const onWave = vi.fn();
  const tracker = new WaveTracker({ getVideo: () => v, modelUrl: () => "/m", onWave, onStatus: (s) => statuses.push(s) });
  return { tracker, statuses, onWave, v };
}

describe("detectWave (pure)", () => {
  const samples = (xs: number[]) => xs.map((x, i) => ({ x, time: i * 100 }));
  it("accepts a wide sweep that returns near start", () => {
    expect(detectWave(samples([0.5, 0.35, 0.65, 0.35, 0.65, 0.4, 0.62, 0.5]))).toBe(true);
  });
  it("rejects too few samples and a one-way slide", () => {
    expect(detectWave(samples([0.5, 0.4]))).toBe(false);
    expect(detectWave(samples([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8]))).toBe(false);
  });
});

describe("WaveTracker lifecycle", () => {
  it("detectForVideo throwing does not silently kill the loop: it recovers from sporadic throws", async () => {
    let calls = 0;
    const lm = fakeLandmarker(() => {
      calls++;
      if (calls === 1) throw new Error("transient");
      return { landmarks: [] };
    });
    const { tracker, statuses, v } = make(lm);
    await tracker.start();
    for (let i = 1; i <= 4; i++) {
      (v as { currentTime: number }).currentTime = i;
      step();
    }
    expect(calls).toBeGreaterThanOrEqual(3); // loop kept going after the first throw
    expect(statuses.some((s) => s.kind === "error")).toBe(false);
    tracker.stop();
  });

  it("3 consecutive throws end the loop, release the landmarker and REPORT a short reason", async () => {
    const lm = fakeLandmarker(() => { throw new Error("dead"); });
    const { tracker, statuses, v } = make(lm);
    await tracker.start();
    for (let i = 1; i <= 5; i++) {
      (v as { currentTime: number }).currentTime = i;
      step();
    }
    const err = statuses.find((s) => s.kind === "error");
    expect(err).toBeTruthy();
    expect(err!.kind === "error" && err!.message.split(/\s+/).length).toBeLessThanOrEqual(8);
    expect(lm.close).toHaveBeenCalledTimes(1);
    expect(rafQueue.filter((f) => !cancelled.has(f.id))).toHaveLength(0);
  });

  it("stop() while the landmarker is still loading closes it afterwards (no leak)", async () => {
    let resolve!: (v: unknown) => void;
    const lm = fakeLandmarker(() => ({ landmarks: [] }));
    vi.mocked(HandLandmarker.createFromOptions).mockReturnValue(new Promise((r) => { resolve = r; }) as never);
    const tracker = new WaveTracker({ getVideo: () => video(), modelUrl: () => "/m", onWave: vi.fn() });
    const p = tracker.start();
    await flush();
    tracker.stop();
    resolve(lm);
    await p;
    expect(lm.close).toHaveBeenCalledTimes(1);
    expect(rafQueue).toHaveLength(0);
  });

  it("double start creates only one landmarker", async () => {
    const lm = fakeLandmarker(() => ({ landmarks: [] }));
    const { tracker } = make(lm);
    await Promise.all([tracker.start(), tracker.start()]);
    expect(HandLandmarker.createFromOptions).toHaveBeenCalledTimes(1);
    tracker.stop();
  });

  it("stop() cancels the rAF loop and closes the landmarker exactly once", async () => {
    const lm = fakeLandmarker(() => ({ landmarks: [] }));
    const { tracker } = make(lm);
    await tracker.start();
    expect(rafQueue.length).toBe(1);
    tracker.stop();
    tracker.stop();
    expect(lm.close).toHaveBeenCalledTimes(1);
    step();
    expect(lm.detectForVideo).not.toHaveBeenCalled();
  });

  it("skips inference while the document is hidden and when currentTime is unchanged", async () => {
    const lm = fakeLandmarker(() => ({ landmarks: [] }));
    const { tracker, v } = make(lm);
    await tracker.start();
    (v as { currentTime: number }).currentTime = 1;
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    step();
    expect(lm.detectForVideo).not.toHaveBeenCalled();
    Object.defineProperty(document, "hidden", { configurable: true, get: () => false });
    step();
    expect(lm.detectForVideo).toHaveBeenCalledTimes(1);
    step(); // same currentTime
    expect(lm.detectForVideo).toHaveBeenCalledTimes(1);
    tracker.stop();
  });

  it("reports a wave once and releases loop + landmarker immediately", async () => {
    const xs = [0.5, 0.35, 0.65, 0.35, 0.65, 0.4, 0.62, 0.5];
    let i = 0;
    const lm = fakeLandmarker(() => ({ landmarks: [[{ x: xs[i++ % xs.length], y: 0.5 }]] }));
    const { tracker, onWave, v } = make(lm);
    await tracker.start();
    for (let k = 1; k <= 12; k++) {
      (v as { currentTime: number }).currentTime = k;
      now += 50;
      step();
    }
    expect(onWave).toHaveBeenCalledTimes(1);
    expect(lm.close).toHaveBeenCalledTimes(1);
    expect(rafQueue.filter((f) => !cancelled.has(f.id))).toHaveLength(0);
  });

  it("model load failure is reported with a short Indonesian reason, not swallowed", async () => {
    vi.mocked(HandLandmarker.createFromOptions).mockRejectedValue(new Error("Failed to fetch model asset"));
    const statuses: WaveTrackerStatus[] = [];
    const tracker = new WaveTracker({ getVideo: () => video(), modelUrl: () => "/m", onWave: vi.fn(), onStatus: (s) => statuses.push(s) });
    await tracker.start();
    const err = statuses.find((s) => s.kind === "error");
    expect(err && err.kind === "error" && err.message).toMatch(/Pelacak|Kamera/);
  });
});
