import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LevelRibbonBookmark, NOTCHES_TO_ARM, NOTCH_PX } from "@/src/components/level/LevelRibbonBookmark";
import {
  PULL_TRIGGER_PX,
  playPullDownTransition,
  resolvePullRelease,
  slideDrawingScreenIn,
} from "@/src/components/level/ribbon-pull";
import { LEVELS } from "@/src/domain/levels";

afterEach(() => {
  cleanup();
  document.getElementById("screen-drawing")?.remove();
});

/**
 * jsdom has no PointerEvent constructor, so build a plain Event carrying the
 * pointer fields the handlers read (clientY / pointerId / button / pointerType).
 */
function pointerEvent(type: string, clientY: number): Event {
  const event = new Event(type, { bubbles: true, cancelable: true });
  for (const [key, value] of Object.entries({
    clientY,
    pointerId: 1,
    pointerType: "mouse",
    button: 0,
  })) {
    Object.defineProperty(event, key, { value, configurable: true });
  }
  return event;
}

function pull(card: HTMLElement, fromY: number, toY: number) {
  act(() => {
    card.dispatchEvent(pointerEvent("pointerdown", fromY));
  });
  act(() => {
    card.dispatchEvent(pointerEvent("pointermove", toY));
  });
  act(() => {
    card.dispatchEvent(pointerEvent("pointerup", toY));
  });
}

const settle = (ms: number) => act(() => new Promise<void>((resolve) => setTimeout(resolve, ms)));

describe("pull release rule", () => {
  it("snaps back below the 150px trigger and activates at/above it", () => {
    expect(PULL_TRIGGER_PX).toBe(150);
    expect(resolvePullRelease(0)).toBe("snap-back");
    expect(resolvePullRelease(149)).toBe("snap-back");
    expect(resolvePullRelease(150)).toBe("activate");
    expect(resolvePullRelease(320)).toBe("activate");
  });

  it("treats non-finite / negative pulls as snap-back (defensive)", () => {
    expect(resolvePullRelease(Number.NaN)).toBe("snap-back");
    expect(resolvePullRelease(Number.POSITIVE_INFINITY)).toBe("snap-back");
    expect(resolvePullRelease(-40)).toBe("snap-back");
  });
});

describe("Level ribbon pull", () => {
  it(`a pull shorter than ${NOTCHES_TO_ARM} notches does not start the level`, async () => {
    const onSelect = vi.fn();
    render(<LevelRibbonBookmark levels={LEVELS} onSelectLevel={onSelect} />);
    const card = screen.getByTestId("level-card-1");

    pull(card, 200, 260); // 60px, one notch

    await settle(900);
    expect(onSelect).not.toHaveBeenCalled();
    // The trailing synthetic click after a drag is suppressed.
    fireEvent.click(card);
    await settle(100);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("a full pull starts Level 1 exactly once, after the snap and sway", async () => {
    const onSelect = vi.fn();
    render(<LevelRibbonBookmark levels={LEVELS} onSelectLevel={onSelect} />);
    const card = screen.getByTestId("level-card-1");

    pull(card, 200, 200 + NOTCHES_TO_ARM * NOTCH_PX + 20);
    // The level does not start at release: the ribbon snaps taut and sways first.
    expect(onSelect).not.toHaveBeenCalled();
    await waitFor(() => expect(onSelect).toHaveBeenCalledTimes(1), { timeout: 3000 });
    expect(onSelect).toHaveBeenCalledWith(LEVELS[0]);

    fireEvent.click(card);
    await settle(200);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("shows the pulling state and counts notches while the drag is live", () => {
    const onSelect = vi.fn();
    render(<LevelRibbonBookmark levels={LEVELS} onSelectLevel={onSelect} />);
    const card = screen.getByTestId("level-card-1");

    act(() => {
      card.dispatchEvent(pointerEvent("pointerdown", 100));
    });
    expect(card.className).toContain("is-pulling");

    act(() => {
      card.dispatchEvent(pointerEvent("pointermove", 100 + NOTCH_PX * 2 + 5));
    });
    expect(card.dataset.notch).toBe("2");

    act(() => {
      card.dispatchEvent(pointerEvent("pointercancel", 180));
    });
    expect(card.className).not.toContain("is-pulling");
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("a plain click pulls the ribbon by itself and starts Level 1", async () => {
    const onSelect = vi.fn();
    render(<LevelRibbonBookmark levels={LEVELS} onSelectLevel={onSelect} />);

    fireEvent.click(screen.getByTestId("level-card-1"));

    await waitFor(() => expect(onSelect).toHaveBeenCalledTimes(1), { timeout: 3000 });
    expect(onSelect).toHaveBeenCalledWith(LEVELS[0]);
  });

  it("locked ribbons never start and say what to finish first", () => {
    const onSelect = vi.fn();
    render(<LevelRibbonBookmark levels={LEVELS} onSelectLevel={onSelect} />);
    const card = screen.getByTestId("level-card-2");

    pull(card, 200, 400);
    fireEvent.click(card);

    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getByRole("status").textContent).toContain("Selesaikan Bab 1 dulu");
  });
});

describe("GSAP page slide transition", () => {
  function mountDrawingScreen() {
    const node = document.createElement("section");
    node.id = "screen-drawing";
    document.body.appendChild(node);
    return node;
  }

  it("returns false while #screen-drawing is not mounted yet", () => {
    expect(slideDrawingScreenIn()).toBe(false);
  });

  it("starts the drawing screen above the viewport when the node exists", () => {
    const node = mountDrawingScreen();
    expect(slideDrawingScreenIn()).toBe(true);
    expect(node.style.transform).toContain("-100%");
    expect(slideDrawingScreenIn()).toBe(true); // idempotent (kills prior tween)
  });

  it("playPullDownTransition picks up the node on the first frame", () => {
    const node = mountDrawingScreen();
    playPullDownTransition(document, 100);
    expect(node.style.transform).toContain("-100%");
  });
});
