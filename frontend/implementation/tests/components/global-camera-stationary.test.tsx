import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import gsap from "gsap";
import { GlobalCamera } from "@/src/components/camera/GlobalCamera";

vi.mock("gsap", () => {
  const mockGsap = {
    fromTo: vi.fn(),
    killTweensOf: vi.fn(),
    to: vi.fn(),
    set: vi.fn(),
  };
  return { default: mockGsap, ...mockGsap };
});

vi.mock("@mediapipe/tasks-vision", () => ({
  FilesetResolver: { forVisionTasks: vi.fn().mockResolvedValue({}) },
  HandLandmarker: { createFromOptions: vi.fn().mockResolvedValue({ detectForVideo: vi.fn(), close: vi.fn() }) },
}));

vi.mock("@/camera/shared-stream", () => ({ setSharedStream: vi.fn() }));

afterEach(cleanup);

describe("GlobalCamera stationary (no FLIP when entering or staying in floating mode)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (gsap.fromTo as any).mockClear();
    (gsap.killTweensOf as any).mockClear();
    (gsap.set as any).mockClear();

    // Mock real-looking non-zero bounding rects so morph wouldn't be skipped solely due to 0 size
    Element.prototype.getBoundingClientRect = vi.fn().mockImplementation(function (this: HTMLElement) {
      if (this.dataset?.testid === "camera-card") {
        return {
          top: 100,
          left: 100,
          width: 320,
          height: 240,
          right: 420,
          bottom: 340,
          x: 100,
          y: 100,
          toJSON: () => {},
        };
      }
      return {
        top: 0,
        left: 0,
        width: 1000,
        height: 800,
        right: 1000,
        bottom: 800,
        x: 0,
        y: 0,
        toJSON: () => {},
      };
    });
  });

  it("does NOT call fromTo when entering floating from cover, and kills tweens + clears props", () => {
    const { rerender } = render(
      <GlobalCamera mode="cover" modelUrl="/mock-model.task" onSkip={vi.fn()} onWave={vi.fn()} />
    );
    (gsap.fromTo as any).mockClear();
    (gsap.killTweensOf as any).mockClear();
    (gsap.set as any).mockClear();

    rerender(
      <GlobalCamera mode="floating" modelUrl="/mock-model.task" onSkip={vi.fn()} onWave={vi.fn()} />
    );

    const card = screen.getByTestId("camera-card");
    expect(gsap.fromTo).not.toHaveBeenCalled();
    expect(gsap.killTweensOf).toHaveBeenCalledWith(card);
    expect(gsap.set).toHaveBeenCalledWith(
      card,
      expect.objectContaining({
        clearProps: expect.stringMatching(/transform|width|height|x|y/),
      })
    );
  });

  it("does NOT call fromTo on initial floating mount, and kills tweens + clears props", () => {
    render(
      <GlobalCamera mode="floating" modelUrl="/mock-model.task" onSkip={vi.fn()} onWave={vi.fn()} />
    );

    const card = screen.getByTestId("camera-card");
    expect(gsap.fromTo).not.toHaveBeenCalled();
    expect(gsap.killTweensOf).toHaveBeenCalledWith(card);
    expect(gsap.set).toHaveBeenCalledWith(
      card,
      expect.objectContaining({
        clearProps: expect.stringMatching(/transform|width|height|x|y/),
      })
    );
  });

  it("does NOT call fromTo when recessed toggles in floating mode", () => {
    const { rerender } = render(
      <GlobalCamera mode="floating" modelUrl="/mock-model.task" onSkip={vi.fn()} onWave={vi.fn()} recessed />
    );
    (gsap.fromTo as any).mockClear();
    (gsap.killTweensOf as any).mockClear();
    (gsap.set as any).mockClear();

    rerender(
      <GlobalCamera mode="floating" modelUrl="/mock-model.task" onSkip={vi.fn()} onWave={vi.fn()} />
    );

    const card = screen.getByTestId("camera-card");
    expect(gsap.fromTo).not.toHaveBeenCalled();
    expect(gsap.killTweensOf).toHaveBeenCalledWith(card);
    expect(gsap.set).toHaveBeenCalledWith(
      card,
      expect.objectContaining({
        clearProps: expect.stringMatching(/transform|width|height|x|y/),
      })
    );
  });

  it("does NOT call fromTo when staying in floating mode across re-renders", () => {
    const { rerender } = render(
      <GlobalCamera mode="floating" modelUrl="/mock-model.task" onSkip={vi.fn()} onWave={vi.fn()} />
    );
    (gsap.fromTo as any).mockClear();
    (gsap.killTweensOf as any).mockClear();
    (gsap.set as any).mockClear();

    rerender(
      <GlobalCamera mode="floating" modelUrl="/mock-model.task" onSkip={vi.fn()} onWave={vi.fn()} />
    );

    const card = screen.getByTestId("camera-card");
    expect(gsap.fromTo).not.toHaveBeenCalled();
    expect(gsap.killTweensOf).toHaveBeenCalledWith(card);
    expect(gsap.set).toHaveBeenCalledWith(
      card,
      expect.objectContaining({
        clearProps: expect.stringMatching(/transform|width|height|x|y/),
      })
    );
  });

  it("preserves card node and video across cover -> floating", () => {
    const { rerender } = render(
      <GlobalCamera mode="cover" modelUrl="/mock-model.task" onSkip={vi.fn()} onWave={vi.fn()} />
    );
    const cardBefore = screen.getByTestId("camera-card");
    const videoBefore = cardBefore.querySelector("video");

    rerender(
      <GlobalCamera mode="floating" modelUrl="/mock-model.task" onSkip={vi.fn()} onWave={vi.fn()} />
    );

    expect(screen.getByTestId("camera-card")).toBe(cardBefore);
    expect(screen.getByTestId("camera-card").querySelector("video")).toBe(videoBefore);
  });

  it("preserves card node and video across recessed toggle", () => {
    const { rerender } = render(
      <GlobalCamera mode="floating" modelUrl="/mock-model.task" onSkip={vi.fn()} onWave={vi.fn()} recessed />
    );
    const cardBefore = screen.getByTestId("camera-card");
    const videoBefore = cardBefore.querySelector("video");

    rerender(
      <GlobalCamera mode="floating" modelUrl="/mock-model.task" onSkip={vi.fn()} onWave={vi.fn()} />
    );

    expect(screen.getByTestId("camera-card")).toBe(cardBefore);
    expect(screen.getByTestId("camera-card").querySelector("video")).toBe(videoBefore);
  });
});
