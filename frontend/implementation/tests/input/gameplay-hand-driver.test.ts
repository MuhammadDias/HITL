// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { GameplayHandDriver } from "@/src/input/gameplay-hand-driver";
import { setSharedStream, resetSharedStreamForTest } from "@/src/camera/shared-stream";
import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";

vi.mock("@mediapipe/tasks-vision", () => {
  return {
    FilesetResolver: {
      forVisionTasks: vi.fn(),
    },
    HandLandmarker: {
      createFromOptions: vi.fn(),
    },
  };
});

function createMockStream(): MediaStream {
  const track = {
    readyState: "live",
    stop: vi.fn(),
  } as unknown as MediaStreamTrack;
  return {
    getVideoTracks: () => [track],
  } as unknown as MediaStream;
}

function createMockVideo(): HTMLVideoElement {
  return {
    srcObject: null,
    play: vi.fn().mockResolvedValue(undefined),
    readyState: 4,
    currentTime: 1.0,
  } as unknown as HTMLVideoElement;
}

describe("GameplayHandDriver lifecycle regression", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSharedStreamForTest();
  });

  afterEach(() => {
    resetSharedStreamForTest();
  });

  it("stop does not clear borrowed video.srcObject or stop tracks", async () => {
    const stream = createMockStream();
    setSharedStream(stream);

    const video = createMockVideo();
    const mockLandmarker = {
      detectForVideo: vi.fn().mockReturnValue({ landmarks: [] }),
      close: vi.fn(),
    };

    vi.mocked(FilesetResolver.forVisionTasks).mockResolvedValue({} as any);
    vi.mocked(HandLandmarker.createFromOptions).mockResolvedValue(mockLandmarker as any);

    const driver = new GameplayHandDriver({
      video,
      onFrame: vi.fn(),
      onStatus: vi.fn(),
    });

    await driver.start();
    expect(video.srcObject).toBe(stream);

    await driver.stop();
    // Must NOT clear borrowed video srcObject!
    expect(video.srcObject).toBe(stream);
    // Must NEVER stop stream tracks
    const track = stream.getVideoTracks()[0]!;
    expect(track.stop).not.toHaveBeenCalled();
  });

  it("stop during async initialization closes late instance and emits no late callbacks", async () => {
    const stream = createMockStream();
    setSharedStream(stream);
    const video = createMockVideo();

    let resolveVision: (v: any) => void = () => {};
    const visionPromise = new Promise((resolve) => {
      resolveVision = resolve;
    });
    vi.mocked(FilesetResolver.forVisionTasks).mockReturnValue(visionPromise as any);

    const mockLandmarker = {
      detectForVideo: vi.fn(),
      close: vi.fn(),
    };
    vi.mocked(HandLandmarker.createFromOptions).mockResolvedValue(mockLandmarker as any);

    const onFrame = vi.fn();
    const onStatus = vi.fn();

    const driver = new GameplayHandDriver({
      video,
      onFrame,
      onStatus,
    });

    console.log('[TEST] Calling driver.start()');
    const startPromise = driver.start();
    console.log('[TEST] driver.start() called, onStatus calls:', onStatus.mock.calls);
    expect(onStatus).toHaveBeenCalledWith("initializing");

    // Wait for driver to reach FilesetResolver by polling the console log
    // We'll use a small delay to let the driver progress past video.play()
    await new Promise(r => setTimeout(r, 50));
    console.log('[TEST] Delay passed, calling driver.stop()');
    await driver.stop();
    console.log('[TEST] driver.stop() completed');

    // Now resolve FilesetResolver
    console.log('[TEST] Resolving vision promise');
    resolveVision({});
    console.log('[TEST] Awaiting startPromise');
    await startPromise;
    console.log('[TEST] startPromise completed');

    // Must NOT have transitioned to tracking
    expect(onStatus).not.toHaveBeenCalledWith("tracking");
    // Landmarker created after abort must be closed immediately
    expect(mockLandmarker.close).toHaveBeenCalled();
  });

  it("detectForVideo throw cleans up and emits neutral frame", async () => {
    const stream = createMockStream();
    setSharedStream(stream);
    const video = createMockVideo();

    const mockLandmarker = {
      detectForVideo: vi.fn().mockImplementation(() => {
        throw new Error("detect failure");
      }),
      close: vi.fn(),
    };

    vi.mocked(FilesetResolver.forVisionTasks).mockResolvedValue({} as any);
    vi.mocked(HandLandmarker.createFromOptions).mockResolvedValue(mockLandmarker as any);

    const onFrame = vi.fn();
    const onStatus = vi.fn();

    const driver = new GameplayHandDriver({
      video,
      onFrame,
      onStatus,
    });

    // Mock rAF
    let rafCallback: FrameRequestCallback = () => {};
    vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation((cb) => {
      rafCallback = cb;
      return 123;
    });

    await driver.start();
    expect(onStatus).toHaveBeenCalledWith("tracking");

    // Advance loop
    video.currentTime = 2.0;
    rafCallback(100);

    expect(onStatus).toHaveBeenCalledWith("error");
    expect(onFrame).toHaveBeenLastCalledWith({
      tracked: false,
      cursor: null,
      pinched: false,
      input: { left: false, right: false, jump: false },
    });
    // Resources must be cleaned up (landmarker closed)
    expect(mockLandmarker.close).toHaveBeenCalled();
  });

  it("stalled/lost frame outputs neutral frame", async () => {
    const stream = createMockStream();
    setSharedStream(stream);
    const video = createMockVideo();

    const mockLandmarker = {
      detectForVideo: vi.fn().mockReturnValue({ landmarks: [] }),
      close: vi.fn(),
    };

    vi.mocked(FilesetResolver.forVisionTasks).mockResolvedValue({} as any);
    vi.mocked(HandLandmarker.createFromOptions).mockResolvedValue(mockLandmarker as any);

    const onFrame = vi.fn();
    const onStatus = vi.fn();

    const driver = new GameplayHandDriver({
      video,
      onFrame,
      onStatus,
    });

    let rafCallback: FrameRequestCallback = () => {};
    vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation((cb) => {
      rafCallback = cb;
      return 123;
    });

    await driver.start();

    // Advance time beyond STALLED_FRAME_THRESHOLD_MS (300ms) with same video.currentTime
    const startPerf = performance.now();
    vi.spyOn(performance, "now").mockReturnValue(startPerf + 400);

    rafCallback(startPerf + 400);

    expect(onStatus).toHaveBeenCalledWith("tracking-lost");
    expect(onFrame).toHaveBeenLastCalledWith({
      tracked: false,
      cursor: null,
      pinched: false,
      input: { left: false, right: false, jump: false },
    });
  });
});
