/**
 * KAPLAY runtime entry point. Creates the engine and hands over to the integrated (stage
 * artwork) scene or the legacy scene. The implementation lives in ./runtime/*; the public API is
 * re-exported here so existing imports keep working.
 */
import { createIntegratedScene } from "./runtime/integrated-scene";
import { createLegacyScene } from "./runtime/legacy-scene";
import { nextLabelFont, quitActiveEngine, setActiveEngine } from "./runtime/engine";
import type { KaplayGameHandle, KaplayGameOptions } from "./runtime/types";

export { CHARACTER_VISUAL_SCALE } from "./runtime/constants";
export { resolveHorizontalMovementIntent } from "./runtime/movement";
export {
  integratedGoalReached,
  integratedPlacementAllowed,
  rectanglesOverlap,
} from "./runtime/rules";
export type { GameOutcome, KaplayGameHandle, KaplayGameOptions } from "./runtime/types";

export async function createKaplayGame(o: KaplayGameOptions): Promise<KaplayGameHandle> {
  const factory = (await import("kaplay")).default;
  quitActiveEngine();
  const pixelDensity = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  const effectivePixelDensity = o.integrated ? Math.max(2, pixelDensity) : pixelDensity;
  const k = await factory({
    global: false,
    canvas: o.canvas,
    pixelDensity: effectivePixelDensity,
    ...(o.integrated
      ? { width: 800, height: 450, stretch: true, letterbox: true, texFilter: "linear" as const }
      : {}),
    background: o.integrated ? [0, 0, 0, 0] : [232, 239, 227],
    debug: false,
  });
  // No default black loading screen over the world while sprites load: the page behind it stays visible.
  if (o.integrated && typeof k.onLoading === "function") k.onLoading(() => undefined);
  setActiveEngine(k);
  const labelFont = nextLabelFont();
  return o.integrated
    ? createIntegratedScene(k, o, labelFont)
    : createLegacyScene(k, o, labelFont, pixelDensity);
}
