import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { LevelRibbonBookmark } from "@/src/components/level/LevelRibbonBookmark";
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
    window.dispatchEvent(pointerEvent("pointermove", toY));
  });
  act(() => {
    window.dispatchEvent(pointerEvent("pointerup", toY));
  });
}

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

describe("Level 1 pointer drag", () => {
  it("pull shorter than 150px does not activate the level", () => {
    const onSelect = vi.fn();
    render(<LevelRibbonBookmark levels={LEVELS} onSelectLevel={onSelect} />);
    const card = screen.getByTestId("level-card-1");

    pull(card, 200, 260); // 60px

    expect(onSelect).not.toHaveBeenCalled();
    // Trailing synthetic click is suppressed after the pull release.
    fireEvent.click(card);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("pull of 150px or more activates Level 1 exactly once", () => {
    const onSelect = vi.fn();
    render(<LevelRibbonBookmark levels={LEVELS} onSelectLevel={onSelect} />);
    const card = screen.getByTestId("level-card-1");

    pull(card, 200, 350); // exactly 150px

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(LEVELS[0]);

    // The drag already decided on pointerup — a follow-up click must not
    // fire the level a second time.
    fireEvent.click(card);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("marks the ribbon as pulling while the drag is live", () => {
    const onSelect = vi.fn();
    render(<LevelRibbonBookmark levels={LEVELS} onSelectLevel={onSelect} />);
    const card = screen.getByTestId("level-card-1");

    act(() => {
      card.dispatchEvent(pointerEvent("pointerdown", 100));
    });
    expect(card.className).toContain("is-dragging");

    act(() => {
      window.dispatchEvent(pointerEvent("pointermove", 180));
    });
    expect(card.className).toContain("is-dragging");

    act(() => {
      window.dispatchEvent(pointerEvent("pointercancel", 180));
    });
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("a plain tap (no movement) still activates Level 1", () => {
    const onSelect = vi.fn();
    render(<LevelRibbonBookmark levels={LEVELS} onSelectLevel={onSelect} />);
    const card = screen.getByTestId("level-card-1");

    pull(card, 200, 200); // 0px
    fireEvent.click(card);

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(LEVELS[0]);
  });

  it("locked ribbons keep plain click semantics (no drag session)", () => {
    const onSelect = vi.fn();
    render(<LevelRibbonBookmark levels={LEVELS} onSelectLevel={onSelect} />);
    const card = screen.getByTestId("level-card-2");

    pull(card, 200, 400);
    fireEvent.click(card);

    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getByRole("status").textContent).toContain("Level 2 masih terkunci");
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
