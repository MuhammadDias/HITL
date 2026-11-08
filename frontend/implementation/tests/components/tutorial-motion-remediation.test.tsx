import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, cleanup, act } from "@testing-library/react";
import { gsap } from "gsap";
import { TutorialBrochure } from "@/src/components/onboarding/TutorialBrochure";

describe("Tutorial Brochure card animation", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("deals, fans and opens the first card on one real timeline, and never skips by itself", async () => {
    const onStart = vi.fn();
    const spy = vi.spyOn(gsap, "timeline");
    await act(async () => {
      render(<TutorialBrochure onStart={onStart} />);
    });
    expect(spy).toHaveBeenCalled();
    const first = spy.mock.results[0]!.value as gsap.core.Timeline;
    // A real choreography: deal-in + fan + open the first card is well over a second of motion.
    expect(first.totalDuration()).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByRole("article")).toHaveLength(3);
    expect(onStart).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("keeps Lanjut locked until the practice of the open card is done", async () => {
    await act(async () => {
      render(<TutorialBrochure onStart={() => {}} />);
    });
    const cta = document.querySelector(".tutorial-card-1 .brochure-cta") as HTMLButtonElement;
    expect(cta.disabled).toBe(true);
  });
});
