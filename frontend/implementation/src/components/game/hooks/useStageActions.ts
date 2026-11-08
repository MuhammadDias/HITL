/**
 * Button-level actions of the world stage (confirm placement, reposition, retry, draw again,
 * pick an earlier creation). They bridge the GameController and the stage's React state.
 */
import type { MutableRefObject } from "react";
import type { WorldCreation } from "@/src/game/creation-store";
import type { GameController } from "@/src/game/game-controller";
import type { StageOutcome } from "../game-stage-types";

const ILLEGAL_PLACEMENT_MESSAGE = "Penempatan tidak legal. Objek tidak hilang.";

interface UseStageActionsOptions {
  controllerRef: MutableRefObject<GameController | null>;
  canvasRef: MutableRefObject<HTMLCanvasElement | null>;
  outcome: StageOutcome | null;
  setOutcome: (outcome: StageOutcome | null) => void;
  setFailReason: (reason: string) => void;
  position: number;
  placementY: number;
  setPosition: (x: number) => void;
  setPlacementY: (y: number) => void;
  setPlacementError: (message: string) => void;
  onRetry?: () => void;
  onRedraw: () => void;
  onCreateAnotherObject?: () => void;
}

export function useStageActions({
  controllerRef,
  canvasRef,
  outcome,
  setOutcome,
  setFailReason,
  position,
  placementY,
  setPosition,
  setPlacementY,
  setPlacementError,
  onRetry,
  onRedraw,
  onCreateAnotherObject,
}: UseStageActionsOptions) {
  /** Read the pending object's live position from the canvas telemetry (falls back to React state). */
  function pendingPositionFromCanvas(fallbackX: number, fallbackY: number) {
    const data = canvasRef.current?.dataset;
    return {
      x: Number(data?.objectX ?? fallbackX),
      y: Number(data?.objectY ?? fallbackY),
    };
  }

  function confirmPlacement() {
    const { x, y } = pendingPositionFromCanvas(position, placementY);
    if (controllerRef.current?.commitPlacementAt(x, y)) {
      setOutcome(null);
    } else {
      setPlacementError(ILLEGAL_PLACEMENT_MESSAGE);
    }
  }

  function reposition() {
    setOutcome(null);
    setFailReason("");
    controllerRef.current?.reposition();
    setPosition(Number(canvasRef.current?.dataset.objectX ?? position));
    setPlacementY(Number(canvasRef.current?.dataset.objectY ?? 320));
  }

  function retryFromCheckpoint() {
    controllerRef.current?.retry();
    setOutcome(null);
    setFailReason("");
    onRetry?.();
  }

  function selectCreation(creation: WorldCreation) {
    if (controllerRef.current?.selectCreation(creation.id)) {
      setOutcome(null);
      setPosition(creation.x);
      setPlacementY(creation.y);
    }
  }

  function drawAgain() {
    if (outcome === "fail" || !onCreateAnotherObject) onRedraw();
    else onCreateAnotherObject();
  }

  return { confirmPlacement, reposition, retryFromCheckpoint, selectCreation, drawAgain };
}
