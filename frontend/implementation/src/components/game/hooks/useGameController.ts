/**
 * Lifecycle of the KAPLAY GameController behind the world stage: mounts it once the student has
 * entered the world, tears it down on change/unmount, and mirrors its outcome / ready / error state.
 */
import { useEffect, useState, type MutableRefObject } from "react";
import type { LevelDefinition } from "@/src/domain/levels";
import type { DrawingInput, HumanDecision, ObjectBehavior } from "@/src/domain/types";
import { env } from "@/src/config/env";
import type { WorldCreation } from "@/src/game/creation-store";
import type { GameController } from "@/src/game/game-controller";
import type { GameStageProps, StageOutcome } from "../game-stage-types";

interface UseGameControllerOptions {
  canvasRef: MutableRefObject<HTMLCanvasElement | null>;
  controllerRef: MutableRefObject<GameController | null>;
  /** Always points at the newest props, so async game callbacks never use stale ones. */
  latest: MutableRefObject<GameStageProps>;
  entered: boolean;
  integrated: boolean | undefined;
  creations: WorldCreation[] | undefined;
  level: LevelDefinition;
  behavior: ObjectBehavior;
  decision: HumanDecision;
  drawingInput: DrawingInput | null;
  /** Release all held keys/buttons (called when the game reports an outcome). */
  releaseManualInput: () => void;
  /** Called with the pending object's position after the fall animation ends (integrated stage only). */
  onFallPosition: (x: number, y: number) => void;
}

export function useGameController({
  canvasRef,
  controllerRef,
  latest,
  entered,
  integrated,
  creations,
  level,
  behavior,
  decision,
  drawingInput,
  releaseManualInput,
  onFallPosition,
}: UseGameControllerOptions) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [outcome, setOutcome] = useState<StageOutcome | null>(null);
  const [failReason, setFailReason] = useState("");

  useEffect(() => {
    if (!entered) return;
    let cancelled = false;
    let instance: GameController | null = null;
    setReady(false);
    setError("");

    async function mountGame() {
      try {
        const { GameController: GameControllerClass } = await import("@/src/game/game-controller");
        const canvas = canvasRef.current;
        if (cancelled || !canvas) return;
        instance = new GameControllerClass();
        controllerRef.current = instance;
        if (env.testHooksEnabled && typeof window !== "undefined") window.__skbGameController = instance;
        await instance.mount(
          canvas,
          level,
          behavior,
          decision.finalLabel,
          drawingInput,
          (result, reason) => {
            if (cancelled) return;
            releaseManualInput();
            setOutcome(result);
            if (reason) setFailReason(reason);
            latest.current.onOutcomeObserved?.(result);
          },
          () => {
            if (cancelled) return;
            if (integrated && canvasRef.current) {
              onFallPosition(
                Number(canvasRef.current.dataset.objectX ?? 0),
                Number(canvasRef.current.dataset.objectY ?? 0),
              );
            }
            latest.current.onFallComplete();
          },
          () => {
            if (!cancelled) latest.current.onCommitPlacement();
          },
          () => {
            if (!cancelled) latest.current.onReposition();
          },
          {
            integrated,
            creations,
            onCreationsChange: (items: WorldCreation[]) =>
              latest.current.onCreationsChange?.(items),
          },
        );
        if (cancelled) {
          instance.unmount();
          return;
        }
        setReady(true);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    }
    void mountGame();

    return () => {
      cancelled = true;
      instance?.unmount();
      controllerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level.levelId, decision, behavior, drawingInput, entered]);

  return { ready, error, outcome, setOutcome, failReason, setFailReason };
}
