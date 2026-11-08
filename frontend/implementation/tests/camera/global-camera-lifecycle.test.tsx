// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";
import { GlobalCamera } from "@/src/components/camera/GlobalCamera";
import { getSharedStream, resetSharedStreamForTest } from "@/src/camera/shared-stream";

vi.mock("gsap", () => {
  const g = { fromTo: vi.fn(), killTweensOf: vi.fn(), to: vi.fn(), set: vi.fn() };
  return { default: g, ...g };
});
// The cover Momo has its own gsap engine; these tests are about the camera lifecycle only.
vi.mock("@/src/components/momo/MomoGuide", () => ({ MomoGuide: () => null }));
vi.mock("@mediapipe/tasks-vision", () => ({
  FilesetResolver: { forVisionTasks: vi.fn() },
  HandLandmarker: { createFromOptions: vi.fn() },
}));

interface FakeTrack {
  readyState: string;
  stop: ReturnType<typeof vi.fn>;
  addEventListener: (t: string, f: () => void) => void;
  removeEventListener: () => void;
  getSettings: () => { deviceId: string };
  fire(type: string): void;
}
function fakeStream() {
  const listeners: Record<string, Array<() => void>> = {};
  const track: FakeTrack = {
    readyState: "live",
    stop: vi.fn(() => { track.readyState = "ended"; }),
    addEventListener: (t, f) => { (listeners[t] ??= []).push(f); },
    removeEventListener: () => undefined,
    getSettings: () => ({ deviceId: "cam1" }),
    fire: (t) => (listeners[t] ?? []).forEach((f) => f()),
  };
  const stream = { getTracks: () => [track], getVideoTracks: () => [track] } as unknown as MediaStream;
  return { stream, track };
}

let rafQueue: Array<{ id: number; cb: FrameRequestCallback }> = [];
let rafId = 0;
const cancelledRaf = new Set<number>();
const liveRaf = () => rafQueue.filter((f) => !cancelledRaf.has(f.id)).length;
function stepRaf() {
  const q = rafQueue.splice(0);
  for (const f of q) if (!cancelledRaf.has(f.id)) f.cb(0);
}
const tick = async () => { await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };

let getUserMedia: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  // restoreAllMocks() in afterEach also resets the setup-file stubs: re-install them.
  HTMLMediaElement.prototype.play = vi.fn(() => Promise.resolve());
  HTMLMediaElement.prototype.pause = vi.fn();
  resetSharedStreamForTest();
  rafQueue = []; rafId = 0; cancelledRaf.clear();
  vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation((cb) => { rafQueue.push({ id: ++rafId, cb }); return rafId; });
  vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation((id) => { cancelledRaf.add(id as number); });
  getUserMedia = vi.fn();
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia, enumerateDevices: vi.fn().mockResolvedValue([]) },
  });
  vi.mocked(FilesetResolver.forVisionTasks).mockResolvedValue({} as never);
  // jsdom: make the <video> look ready so frame loops run
  Object.defineProperty(HTMLMediaElement.prototype, "readyState", { configurable: true, get: () => 4 });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const toggle = () => screen.getByTestId("btn-camera-toggle-switch");
const card = () => screen.getByTestId("camera-card");
const note = () => screen.getByTestId("camera-status").textContent ?? "";

describe("GlobalCamera: getUserMedia race (toggle off while the permission prompt is open)", () => {
  it("does NOT leave a live stream / REC when the switch is turned off before getUserMedia resolves", async () => {
    let resolveGum!: (s: MediaStream) => void;
    const { stream, track } = fakeStream();
    getUserMedia.mockReturnValue(new Promise((r) => { resolveGum = r; }));
    render(<GlobalCamera mode="floating" modelUrl="/m" />);
    fireEvent.click(toggle());
    expect(toggle().getAttribute("aria-checked")).toBe("true");
    fireEvent.click(toggle()); // off while pending
    expect(toggle().getAttribute("aria-checked")).toBe("false");
    await act(async () => { resolveGum(stream); });
    await tick();
    expect(track.stop).toHaveBeenCalled();
    expect(getSharedStream()).toBeNull();
    expect(card().className).not.toContain("has-stream");
    expect(toggle().getAttribute("aria-checked")).toBe("false");
  });

  it("off -> on while the first request is pending: only the newest stream is published, the stale one is stopped", async () => {
    const first = fakeStream();
    const second = fakeStream();
    let resolve1!: (s: MediaStream) => void;
    getUserMedia
      .mockReturnValueOnce(new Promise((r) => { resolve1 = r; }))
      .mockResolvedValueOnce(second.stream);
    render(<GlobalCamera mode="floating" modelUrl="/m" />);
    fireEvent.click(toggle());
    fireEvent.click(toggle());
    fireEvent.click(toggle());
    await tick();
    expect(getSharedStream()).toBe(second.stream);
    await act(async () => { resolve1(first.stream); });
    await tick();
    expect(first.track.stop).toHaveBeenCalled();
    expect(second.track.stop).not.toHaveBeenCalled();
    expect(getSharedStream()).toBe(second.stream);
  });

  it("unmount while getUserMedia is pending stops the late stream", async () => {
    const { stream, track } = fakeStream();
    let resolveGum!: (s: MediaStream) => void;
    getUserMedia.mockReturnValue(new Promise((r) => { resolveGum = r; }));
    const { unmount } = render(<GlobalCamera mode="floating" modelUrl="/m" />);
    fireEvent.click(toggle());
    unmount();
    await act(async () => { resolveGum(stream); });
    expect(track.stop).toHaveBeenCalled();
    expect(getSharedStream()).toBeNull();
  });
});

describe("GlobalCamera: failures always leave a short Indonesian reason and a working fallback", () => {
  const words = (s: string) => s.trim().split(/\s+/).length;

  it.each([
    ["NotAllowedError", /Izin kamera ditolak/],
    ["NotFoundError", /Kamera tidak ditemukan/],
    ["NotReadableError", /Kamera sedang dipakai/],
  ])("%s -> visible reason, switch back to off, no stream", async (name, re) => {
    const err = new DOMException(name, name);
    getUserMedia.mockRejectedValue(err);
    render(<GlobalCamera mode="floating" modelUrl="/m" />);
    fireEvent.click(toggle());
    await tick();
    expect(note()).toMatch(re);
    expect(words(note())).toBeLessThanOrEqual(8);
    expect(toggle().getAttribute("aria-checked")).toBe("false");
    expect(card().className).not.toContain("has-stream");
    expect(getSharedStream()).toBeNull();
  });

  it("student can retry after a failure", async () => {
    getUserMedia.mockRejectedValueOnce(new DOMException("x", "NotAllowedError"));
    const ok = fakeStream();
    getUserMedia.mockResolvedValueOnce(ok.stream);
    render(<GlobalCamera mode="floating" modelUrl="/m" />);
    fireEvent.click(toggle());
    await tick();
    fireEvent.click(toggle());
    await tick();
    expect(getSharedStream()).toBe(ok.stream);
    expect(note()).toBe("");
  });

  it("camera unplugged / revoked mid-session (track 'ended') tears down and explains", async () => {
    const { stream, track } = fakeStream();
    getUserMedia.mockResolvedValue(stream);
    render(<GlobalCamera mode="floating" modelUrl="/m" />);
    fireEvent.click(toggle());
    await tick();
    expect(getSharedStream()).toBe(stream);
    act(() => track.fire("ended"));
    expect(getSharedStream()).toBeNull();
    expect(note()).toMatch(/Kamera terputus/);
    expect(toggle().getAttribute("aria-checked")).toBe("false");
  });
});

describe("GlobalCamera: GPU -> CPU delegate fallback is surfaced", () => {
  it("retries on CPU once when GPU creation fails and shows the delegate", async () => {
    const lm = { detectForVideo: vi.fn(() => ({ landmarks: [] })), close: vi.fn() };
    vi.mocked(HandLandmarker.createFromOptions).mockRejectedValueOnce(new Error("no webgl")).mockResolvedValueOnce(lm as never);
    getUserMedia.mockResolvedValue(fakeStream().stream);
    render(<GlobalCamera mode="cover" modelUrl="/m" waveStartDelayMs={0} />);
    fireEvent.click(toggle());
    await tick();
    await tick();
    const delegates = vi.mocked(HandLandmarker.createFromOptions).mock.calls.map(
      (c) => (c[1] as { baseOptions: { delegate: string } }).baseOptions.delegate,
    );
    expect(delegates).toEqual(["GPU", "CPU"]);
    expect(note()).toContain("CPU");
    expect(card().getAttribute("data-delegate")).toContain("CPU");
  });
});

describe("GlobalCamera: wave loop robustness + cleanup", () => {
  it("a detectForVideo throw does not silently kill the wave loop", async () => {
    const xs = [0.5, 0.35, 0.65, 0.35, 0.65, 0.4, 0.62, 0.5, 0.3, 0.7];
    let n = 0;
    const lm = {
      detectForVideo: vi.fn(() => {
        n++;
        if (n === 2) throw new Error("transient");
        return { landmarks: [[{ x: xs[n % xs.length], y: 0.5 }]] };
      }),
      close: vi.fn(),
    };
    vi.mocked(HandLandmarker.createFromOptions).mockResolvedValue(lm as never);
    getUserMedia.mockResolvedValue(fakeStream().stream);
    const onWave = vi.fn();
    render(<GlobalCamera mode="cover" modelUrl="/m" waveStartDelayMs={0} onWave={onWave} />);
    fireEvent.click(toggle());
    await tick();
    await tick();
    const video = document.querySelector("video")!;
    let t = 0;
    for (let i = 1; i <= 30 && !onWave.mock.calls.length; i++) {
      Object.defineProperty(video, "currentTime", { configurable: true, value: ++t });
      stepRaf();
    }
    expect(lm.detectForVideo.mock.calls.length).toBeGreaterThan(3);
    expect(onWave).toHaveBeenCalledTimes(1);
  });

  it("unmount stops every track, cancels the rAF loop and closes the landmarker", async () => {
    const lm = { detectForVideo: vi.fn(() => ({ landmarks: [] })), close: vi.fn() };
    vi.mocked(HandLandmarker.createFromOptions).mockResolvedValue(lm as never);
    const { stream, track } = fakeStream();
    getUserMedia.mockResolvedValue(stream);
    const { unmount } = render(<GlobalCamera mode="cover" modelUrl="/m" waveStartDelayMs={0} />);
    fireEvent.click(toggle());
    await tick();
    await tick();
    expect(liveRaf()).toBeGreaterThan(0);
    unmount();
    expect(track.stop).toHaveBeenCalled();
    expect(lm.close).toHaveBeenCalledTimes(1);
    expect(liveRaf()).toBe(0);
    expect(getSharedStream()).toBeNull();
  });

  it("docking to the PIP (cover -> floating) stops the wave loop and landmarker but keeps the stream", async () => {
    const lm = { detectForVideo: vi.fn(() => ({ landmarks: [] })), close: vi.fn() };
    vi.mocked(HandLandmarker.createFromOptions).mockResolvedValue(lm as never);
    const { stream, track } = fakeStream();
    getUserMedia.mockResolvedValue(stream);
    const { rerender } = render(<GlobalCamera mode="cover" modelUrl="/m" waveStartDelayMs={0} />);
    fireEvent.click(toggle());
    await tick();
    await tick();
    rerender(<GlobalCamera mode="floating" modelUrl="/m" />);
    expect(lm.close).toHaveBeenCalledTimes(1);
    expect(liveRaf()).toBe(0);
    expect(track.stop).not.toHaveBeenCalled();
    expect(getSharedStream()).toBe(stream);
  });

  it("window 'pagehide' releases the camera", async () => {
    const { stream, track } = fakeStream();
    getUserMedia.mockResolvedValue(stream);
    render(<GlobalCamera mode="floating" modelUrl="/m" />);
    fireEvent.click(toggle());
    await tick();
    act(() => { window.dispatchEvent(new Event("pagehide")); });
    expect(track.stop).toHaveBeenCalled();
    expect(getSharedStream()).toBeNull();
  });
});

describe("GlobalCamera: hand-drawing status surfacing", () => {
  it("shows the hand error reason and syncs the Pointer/Tangan switch back to Pointer", async () => {
    render(<GlobalCamera mode="floating" modelUrl="/m" recessed />);
    fireEvent.click(screen.getByText("Tangan"));
    expect(screen.getByText("Tangan").getAttribute("aria-pressed")).toBe("true");
    act(() => {
      window.dispatchEvent(new CustomEvent("hand-input-status", { detail: { kind: "error", reason: "permission-denied", message: "Izin kamera ditolak. Pakai mouse atau keyboard." } }));
      window.dispatchEvent(new CustomEvent("drawing-input-mode", { detail: "pointer" }));
    });
    expect(note()).toMatch(/Izin kamera ditolak/);
    expect(screen.getByText("Pointer").getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText("Tangan").getAttribute("aria-pressed")).toBe("false");
  });
});
