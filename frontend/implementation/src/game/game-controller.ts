import type { LevelContext, ObjectBehavior } from "../domain/types";
import type { KaplayGameHandle } from "./kaplay-runtime";

/**
 * TASK 04/15 — Game controller boundary for React.
 * Guarantees a single live KAPLAY instance and deterministic teardown
 * (no duplicate loops/listeners across remounts or repeated cycles).
 */
export class GameController {
  private handle: KaplayGameHandle | null = null;

  async mount(
    canvas: HTMLCanvasElement,
    level: LevelContext,
    behavior: ObjectBehavior,
    finalLabel: string,
    onOutcome: (outcome: "success" | "fail") => void,
  ): Promise<void> {
    this.unmount();
    console.log("[GameController] Mounting game with behavior:", behavior, "label:", finalLabel);
    const { createKaplayGame } = await import("./kaplay-runtime");
    // Re-check after the await: unmount may have been called meanwhile.
    if (this.handle !== null) return;
    this.handle = await createKaplayGame({ canvas, level, behavior, finalLabel, onOutcome });
    console.log("[GameController] Game mounted successfully");
  }

  /** Idempotent teardown (StrictMode double-mount safe). */
  unmount(): void {
    this.handle?.destroy();
    this.handle = null;
  }
}
