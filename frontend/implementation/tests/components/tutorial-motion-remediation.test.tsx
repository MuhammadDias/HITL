import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, act } from "@testing-library/react";
import { TutorialBrochure } from "@/src/components/onboarding/TutorialBrochure";

describe("Tutorial Brochure Card Animation Priority", () => {
  beforeEach(() => {
    Element.prototype.animate = vi.fn().mockImplementation(() => ({
      finished: Promise.resolve(),
      cancel: vi.fn(),
      play: vi.fn(),
      pause: vi.fn(),
      reverse: vi.fn(),
      finish: vi.fn(),
    }));
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("plays full tactile card animations without skipping sequence", async () => {
    const onStart = vi.fn();
    vi.useFakeTimers();

    await act(async () => {
      render(<TutorialBrochure onStart={onStart} />);
    });

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    // Animate calls must have real durations (> 0), never zeroed out
    const animateCalls = (Element.prototype.animate as any).mock.calls;
    expect(animateCalls.length).toBeGreaterThan(0);
    const maxDuration = Math.max(
      ...animateCalls.map((call: any) => {
        const options = call[1];
        return typeof options === "number" ? options : (options?.duration ?? 0);
      })
    );
    expect(maxDuration).toBeGreaterThanOrEqual(600);

    // Tutorial must not be auto-skipped
    expect(onStart).not.toHaveBeenCalled();

    vi.useRealTimers();
  });
});
