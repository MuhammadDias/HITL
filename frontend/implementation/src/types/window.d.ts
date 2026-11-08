/**
 * Typed shape of the test-only `window.__skb*` hooks.
 * They are installed ONLY when NEXT_PUBLIC_TEST_HOOKS=1 (see env.testHooksEnabled) and are never present in production builds.
 */
import type { GameController } from "@/src/game/game-controller";
import type { MockPredictionProvider } from "@/src/prediction/mock-prediction-provider";

declare global {
  interface Window {
    /** Forces on-screen/keyboard-independent input for E2E; `null` clears the override. */
    __skbSetInput?: (input: { left?: boolean; right?: boolean; jump?: boolean } | null) => void;
    /** Current override read by the gameplay input sender. */
    __skbOverrideInput?: { left?: boolean; right?: boolean; jump?: boolean };
    /** Moves the pending object in the world (physics coordinates). */
    __skbMovePlacement?: (x: number, y: number) => void;
    /** The live GameController of the mounted world stage. */
    __skbGameController?: GameController;
    /** The deterministic mock prediction provider of the current level. */
    __skbMock?: MockPredictionProvider;
    /** Extra hooks registered by the drawing screen (e.g. the live DrawingSurface). */
    __skbTestHooks?: Record<string, unknown>;
  }
}

export {};
