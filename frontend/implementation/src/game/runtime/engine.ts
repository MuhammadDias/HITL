/**
 * Process-wide KAPLAY engine bookkeeping: only one engine may be alive, and every engine needs
 * its own CSS font key.
 */
import type { KAPLAYCtx } from "kaplay";

let active: KAPLAYCtx | null = null;
let fontGeneration = 0;

/** Quit the previous engine (if any) before a new one is created. */
export function quitActiveEngine(): void {
  active?.quit();
}

export function setActiveEngine(k: KAPLAYCtx): void {
  active = k;
}

/** Quit an engine and forget it if it is the active one. */
export function releaseEngine(k: KAPLAYCtx): void {
  k.quit();
  if (active === k) active = null;
}

/**
 * KAPLAY 3001 caches CSS font atlases globally, even after quit destroys their textures.
 * A per-engine CSS key retains the default face without reusing a dead GL texture.
 */
export function nextLabelFont(): string {
  return `"sketchbook-runtime-${++fontGeneration}", sans-serif`;
}
