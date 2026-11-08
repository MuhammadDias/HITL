/**
 * Tiny KAPLAY component helpers shared by the scene modules.
 */
import type { KAPLAYCtx } from "kaplay";

/** Rectangular collision area anchored at the object's origin. */
export function rectArea(k: KAPLAYCtx, w: number, h: number) {
  return k.area({ shape: new k.Rect(k.vec2(0, 0), w, h) });
}
