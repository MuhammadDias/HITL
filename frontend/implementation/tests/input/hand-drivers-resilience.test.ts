// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";
import { GameplayHandDriver, type GameplayDiagnostic, type GameplayFrame } from "@/src/input/gameplay-hand-driver";
import { HandDrawingDriver } from "@/src/input/mediapipe-input";
import { StrokeStore, type HandInputStatus, type Landmark } from "@/src/input/types";
import { resetSharedStreamForTest, setSharedStream } from "@/src/camera/shared-stream";

vi.mock("@mediapipe/tasks-vision", () => ({
  FilesetResolver: { forVisionTasks: vi.fn() },
  HandLandmarker: { createFromOptions: vi.fn() },
}));
const create = vi.mocked(HandLandmarker.createFromOptions);

function track() {
  const l: Record<string, Array<() => void>> = {};
  const t = {
    readyState: "live",
    stop: vi.fn(() => { t.readyState = "ended"; }),
    addEventListener: (type: string, f: () => void) => { (l[type] ??= []).push(f); },
    removeEventListener: (type: string, f: () => void) => { l[type] = (l[type] ?? []).filter((x) => x !== f); },
    fire: (type: string) => (l[type] ?? []).slice().forEach((f) => f()),
    listenerCount: (type: string) => (l[type] ?? []).length,
  };
  return t;
}
function stream(t = track()) {
  return { s: { getVideoTracks: () => [t], getTracks: () => [t] } as unknown as MediaStream, t };
}
function video() {
  return { srcObject: null, play: vi.fn().mockResolvedValue(undefined), readyState: 4, currentTime: -1 } as unknown as HTMLVideoElement & { currentTime: number };
}
function pose(cursorX: number, gap = 1): Landmark[] {
  const lm: Landmark[] = new Array(21).fill(null).map(() => ({ x: 0.5, y: 0.5 }));
  lm[0] = { x: 0.5, y: 0.9 };
  lm[9] = { x: 0.5, y: 0.7 };
  lm[8] = { x: 1 - cursorX, y: 0.4 };
  lm[4] = { x: 1 - cursorX - gap * 0.2, y: 0.4 };
  return lm;
}

let raf: FrameRequestCallback[] = [];
const cancelled: number[] = [];
const stepRaf = () => { const q = raf.splice(0); q.forEach((cb) => cb(0)); };
const flush = () => new Promise((r) => setTimeout(r, 0));
const setHidden = (h: boolean) => Object.defineProperty(document, "hidden", { configurable: true, get: () => h });

beforeEach(() => {
  vi.clearAllMocks();
  resetSharedStreamForTest();
  raf = []; cancelled.length = 0;
  vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation((cb) => { raf.push(cb); return raf.length; });
  vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation((id) => { cancelled.push(id as number); });
  vi.mocked(FilesetResolver.forVisionTasks).mockResolvedValue({} as never);
  setHidden(false);
});
afterEach(() => { vi.restoreAllMocks(); setHidden(false); resetSharedStreamForTest(); });

const lmk = (detect: () => unknown = () => ({ landmarks: [] })) => ({ detectForVideo: vi.fn(detect), close: vi.fn() });
const delegates = () => create.mock.calls.map((c) => (c[1] as { baseOptions: { delegate: string } }).baseOptions.delegate);

describe("GameplayHandDriver", () => {
  function setup(opts: { enableJump?: boolean } = {}) {
    const { s, t } = stream();
    setSharedStream(s);
    const v = video();
    const frames: GameplayFrame[] = [];
    const statuses: string[] = [];
    const diags: GameplayDiagnostic[] = [];
    const driver = new GameplayHandDriver({
      video: v, onFrame: (f) => frames.push(f), onStatus: (x) => statuses.push(x), onDiagnostic: (d) => diags.push(d), ...opts,
    });
    return { driver, v, frames, statuses, diags, t };
  }
  const neutral = { left: false, right: false, jump: false };

  it("GPU failure retries on CPU and reports the delegate", async () => {
    const lm = lmk();
    create.mockRejectedValueOnce(new Error("no gpu")).mockResolvedValueOnce(lm as never);
    const { driver, statuses, diags } = setup();
    await driver.start();
    expect(delegates()).toEqual(["GPU", "CPU"]);
    expect(statuses).toContain("tracking");
    expect(diags).toContainEqual({ delegate: "CPU (cadangan)" });
    await driver.stop();
  });

  it("model failure (GPU and CPU) -> error status + short Indonesian reason, no loop, nothing leaked", async () => {
    create.mockRejectedValue(new Error("Failed to fetch model asset"));
    const { driver, statuses, diags, frames } = setup();
    await driver.start();
    expect(statuses[statuses.length - 1]).toBe("error");
    const msg = diags.find((d) => d.message)!.message!;
    expect(msg.split(/\s+/).length).toBeLessThanOrEqual(8);
    expect(msg).toMatch(/mouse/i);
    expect(frames[frames.length - 1]!.input).toEqual(neutral);
    expect(raf).toHaveLength(0);
  });

  it("no shared camera -> camera-unavailable with a reason and no getUserMedia", async () => {
    resetSharedStreamForTest();
    const gum = vi.fn();
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: gum } });
    const { driver, statuses, diags } = (() => {
      const v = video(); const statuses: string[] = []; const diags: GameplayDiagnostic[] = [];
      return { driver: new GameplayHandDriver({ video: v, onFrame: vi.fn(), onStatus: (x) => statuses.push(x), onDiagnostic: (d) => diags.push(d) }), statuses, diags };
    })();
    await driver.start();
    expect(statuses[statuses.length - 1]).toBe("camera-unavailable");
    expect(diags[0]!.message).toMatch(/Kamera/);
    expect(gum).not.toHaveBeenCalled();
  });

  it("camera revoked mid-session (shared stream retired): neutral frame, camera-unavailable, landmarker closed, loop cancelled", async () => {
    const lm = lmk(() => ({ landmarks: [pose(0.9)] }));
    create.mockResolvedValue(lm as never);
    const { driver, v, frames, statuses, diags } = setup();
    await driver.start();
    v.currentTime = 1; stepRaf();
    setSharedStream(null);
    await flush();
    expect(frames[frames.length - 1]!.input).toEqual(neutral);
    expect(statuses[statuses.length - 1]).toBe("camera-unavailable");
    expect(diags.some((d) => d.reason === "camera-lost")).toBe(true);
    expect(lm.close).toHaveBeenCalledTimes(1);
    expect(raf.length === 0 || cancelled.length > 0).toBe(true);
  });

  it("track 'ended' (device unplugged) is handled the same way", async () => {
    create.mockResolvedValue(lmk() as never);
    const { driver, t, statuses } = setup();
    await driver.start();
    t.fire("ended");
    await flush();
    expect(statuses[statuses.length - 1]).toBe("camera-unavailable");
  });

  it("stop() removes its track listener and shared-stream subscription", async () => {
    create.mockResolvedValue(lmk() as never);
    const { driver, t } = setup();
    await driver.start();
    expect(t.listenerCount("ended")).toBe(1);
    await driver.stop();
    expect(t.listenerCount("ended")).toBe(0);
  });

  it("hidden tab: no inference, neutral input once, resumes after visible", async () => {
    const lm = lmk(() => ({ landmarks: [pose(0.9)] }));
    create.mockResolvedValue(lm as never);
    const { driver, v, frames } = setup();
    await driver.start();
    for (let i = 1; i <= 6; i++) { v.currentTime = i; stepRaf(); }
    expect(frames[frames.length - 1]!.input.right).toBe(true);
    const calls = lm.detectForVideo.mock.calls.length;
    setHidden(true);
    document.dispatchEvent(new Event("visibilitychange"));
    expect(frames[frames.length - 1]!.input).toEqual(neutral);
    const n = frames.length;
    v.currentTime = 50; stepRaf(); stepRaf();
    expect(lm.detectForVideo.mock.calls.length).toBe(calls);
    expect(frames.length).toBe(n); // neutral reported once, not every rAF
    setHidden(false);
    v.currentTime = 51; stepRaf();
    expect(lm.detectForVideo.mock.calls.length).toBe(calls + 1);
    await driver.stop();
  });

  it("status is emitted on change only, not every frame", async () => {
    create.mockResolvedValue(lmk(() => ({ landmarks: [pose(0.5)] })) as never);
    const { driver, v, statuses } = setup();
    await driver.start();
    for (let i = 1; i <= 10; i++) { v.currentTime = i; stepRaf(); }
    expect(statuses.filter((s) => s === "tracking")).toHaveLength(1);
    await driver.stop();
  });

  it("applies hysteresis: a hand creeping back past 0.35 stays 'left' until 0.40", async () => {
    let x = 0.2;
    create.mockResolvedValue(lmk(() => ({ landmarks: [pose(x)] })) as never);
    const { driver, v, frames } = setup();
    await driver.start();
    for (let i = 1; i <= 6; i++) { v.currentTime = i; stepRaf(); }
    x = 0.37; v.currentTime = 20; stepRaf();
    expect(frames[frames.length - 1]!.input.left).toBe(true);
    await driver.stop();
  });

  it("enableJump maps a held pinch to jump; default does not", async () => {
    create.mockResolvedValue(lmk(() => ({ landmarks: [pose(0.5, 0.2)] })) as never);
    const a = setup({ enableJump: true });
    await a.driver.start();
    for (let i = 1; i <= 8; i++) { a.v.currentTime = i; stepRaf(); }
    expect(a.frames[a.frames.length - 1]!.input.jump).toBe(true);
    await a.driver.stop();
    const b = setup();
    await b.driver.start();
    for (let i = 1; i <= 8; i++) { b.v.currentTime = i; stepRaf(); }
    expect(b.frames[b.frames.length - 1]!.input.jump).toBe(false);
    await b.driver.stop();
  });
});

describe("HandDrawingDriver", () => {
  function setup(extra: Partial<ConstructorParameters<typeof HandDrawingDriver>[0]> = {}) {
    const canvas = document.createElement("canvas");
    canvas.width = 400; canvas.height = 300;
    const v = video();
    const statuses: HandInputStatus[] = [];
    const onRender = vi.fn();
    const onCursor = vi.fn();
    const store = new StrokeStore();
    const driver = new HandDrawingDriver({ canvas, video: v, store, modelUrl: "/m", onStatus: (s) => statuses.push(s), onRender, onCursor, ...extra });
    return { driver, v, statuses, onRender, onCursor, store };
  }

  it("ready status carries the delegate; GPU failure falls back to CPU", async () => {
    const { s } = stream(); setSharedStream(s);
    create.mockRejectedValueOnce(new Error("gpu")).mockResolvedValueOnce(lmk() as never);
    const { driver, statuses } = setup();
    await driver.start();
    expect(delegates()).toEqual(["GPU", "CPU"]);
    expect(statuses).toContainEqual({ kind: "ready", delegate: "CPU (cadangan)" });
    await driver.stop();
  });

  it("camera permission denied -> error with a short Indonesian message (pointer fallback is the caller's job)", async () => {
    const gum = vi.fn().mockRejectedValue(new DOMException("denied", "NotAllowedError"));
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: gum } });
    const { driver, statuses } = setup();
    await driver.start();
    const err = statuses[statuses.length - 1]! as Extract<HandInputStatus, { kind: "error" }>;
    expect(err.kind).toBe("error");
    expect(err.reason).toBe("permission-denied");
    expect(err.message!.split(/\s+/).length).toBeLessThanOrEqual(8);
    expect(err.message).toMatch(/Izin kamera/);
  });

  it("stop() while own getUserMedia is pending stops the late camera (no orphan live stream)", async () => {
    const own = stream();
    let resolve!: (s: MediaStream) => void;
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: vi.fn(() => new Promise((r) => { resolve = r; })) } });
    const { driver } = setup();
    const p = driver.start();
    await flush();
    await driver.stop();
    resolve(own.s);
    await p;
    expect(own.t.stop).toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it("a borrowed stream that ends mid-session reports camera loss and releases the landmarker", async () => {
    const b = stream(); setSharedStream(b.s);
    const lm = lmk();
    create.mockResolvedValue(lm as never);
    const { driver, statuses } = setup();
    await driver.start();
    b.t.fire("ended");
    await flush();
    const err = statuses[statuses.length - 1]! as Extract<HandInputStatus, { kind: "error" }>;
    expect(err.kind).toBe("error");
    expect(err.reason).toBe("camera-unavailable");
    expect(err.message).toMatch(/Kamera terputus/);
    expect(lm.close).toHaveBeenCalledTimes(1);
    expect(b.t.stop).not.toHaveBeenCalled(); // borrowed: owner (GlobalCamera) closes it
  });

  it("detectForVideo throwing ends the stroke, stops the driver and reports (does not spin forever)", async () => {
    const b = stream(); setSharedStream(b.s);
    const lm = lmk(() => { throw new Error("boom"); });
    create.mockResolvedValue(lm as never);
    const { driver, v, statuses, store } = setup();
    await driver.start();
    store.beginStroke(); store.addPoint({ x: 1, y: 1 }); store.addPoint({ x: 9, y: 9 });
    v.currentTime = 1; stepRaf();
    await flush();
    expect(statuses[statuses.length - 1]).toMatchObject({ kind: "error", reason: "tracker-error" });
    expect(store.getStrokes().active).toBeNull();
    expect(lm.close).toHaveBeenCalledTimes(1);
    v.currentTime = 2; stepRaf();
    expect(lm.detectForVideo).toHaveBeenCalledTimes(1);
  });

  it("hidden tab ends an open pinch stroke and skips inference", async () => {
    const b = stream(); setSharedStream(b.s);
    let lm = pose(0.5, 0.1);
    const l = lmk(() => ({ landmarks: [lm] }));
    create.mockResolvedValue(l as never);
    const { driver, v, store } = setup();
    await driver.start();
    v.currentTime = 1; stepRaf();
    v.currentTime = 2; stepRaf();
    expect(store.getStrokes().active).not.toBeNull();
    setHidden(true);
    document.dispatchEvent(new Event("visibilitychange"));
    expect(store.getStrokes().active).toBeNull();
    const calls = l.detectForVideo.mock.calls.length;
    v.currentTime = 3; stepRaf();
    expect(l.detectForVideo.mock.calls.length).toBe(calls);
    await driver.stop();
  });

  it("repeated 'lost' frames while idle do not trigger redraws", async () => {
    const b = stream(); setSharedStream(b.s);
    create.mockResolvedValue(lmk(() => ({ landmarks: [] })) as never);
    const { driver, v, onRender } = setup();
    await driver.start();
    for (let i = 1; i <= 10; i++) { v.currentTime = i; stepRaf(); }
    expect(onRender.mock.calls.length).toBeLessThanOrEqual(1);
    await driver.stop();
  });
});
