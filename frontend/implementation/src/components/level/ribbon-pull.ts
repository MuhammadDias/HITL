import gsap from "gsap";

/**
 * PULL-DOWN BOOKMARK PHYSICS (Level 1 ribbon).
 *
 * Single home for the pull interaction constants + GSAP helpers so the
 * component stays declarative and the rules are unit-testable in isolation:
 *
 *   pull < PULL_TRIGGER_PX  -> ribbon snaps back (elastic.out)
 *   pull >= PULL_TRIGGER_PX -> Level 1 activates, #screen-drawing slides down
 */

/** Minimum downward pull (CSS px) before releasing activates Level 1. */
export const PULL_TRIGGER_PX = 150;

/** Movement (CSS px) before a press counts as a drag instead of a tap. */
export const PULL_DRAG_START_PX = 4;

/** The drawing screen node that slides in after activation. */
export const DRAWING_SCREEN_SELECTOR = "#screen-drawing";

/** How long to wait for #screen-drawing to mount before giving up the slide. */
export const SLIDE_WAIT_TIMEOUT_MS = 4000;

export type PullRelease = "activate" | "snap-back";

/** Pure release rule: does this pull distance unlock the level? */
export function resolvePullRelease(pulledPx: number): PullRelease {
  if (!Number.isFinite(pulledPx) || pulledPx < 0) return "snap-back";
  return pulledPx >= PULL_TRIGGER_PX ? "activate" : "snap-back";
}

/** Track the drag 1:1 with the pointer (clamped: ribbons never fly upward). */
export function setPullOffset(el: HTMLElement, pulledPx: number): void {
  gsap.killTweensOf(el);
  gsap.set(el, { y: Math.max(0, pulledPx) });
}

/** Release below threshold: elastic spring back to rest. */
export function snapRibbonBack(el: HTMLElement, onRest?: () => void): void {
  gsap.killTweensOf(el);
  gsap.to(el, {
    y: 0,
    ease: "elastic.out(1, 0.5)",
    onComplete: () => {
      onRest?.();
    },
  });
}

/** Drop any in-flight pull/snap tween without starting a new one. */
export function cancelPullTweens(el: HTMLElement | null): void {
  if (!el) return;
  gsap.killTweensOf(el);
}

function scheduleFrame(cb: () => void): void {
  if (typeof requestAnimationFrame === "function") {
    requestAnimationFrame(() => cb());
  } else {
    setTimeout(cb, 16);
  }
}

/**
 * Page transition: the drawing screen is yanked down from above, as if pulled
 * by the ribbon. Returns false when the target node is not mounted yet.
 */
export function slideDrawingScreenIn(root: ParentNode = document): boolean {
  const screen = root.querySelector<HTMLElement>(DRAWING_SCREEN_SELECTOR);
  if (!screen) return false;
  gsap.killTweensOf(screen);
  gsap.fromTo(
    screen,
    { y: "-100%" },
    { y: 0, ease: "power3.out", clearProps: "transform" },
  );
  return true;
}

/**
 * Activation entry point: the level entry screen is replaced by the drawing
 * screen in the same React commit, so poll a couple of frames until the node
 * exists, then play the pull-down slide. Safe to call before mount.
 */
export function playPullDownTransition(
  root: ParentNode = document,
  timeoutMs: number = SLIDE_WAIT_TIMEOUT_MS,
): void {
  const startedAt = Date.now();
  const tick = () => {
    if (slideDrawingScreenIn(root)) return;
    if (Date.now() - startedAt >= timeoutMs) return;
    scheduleFrame(tick);
  };
  tick();
}
