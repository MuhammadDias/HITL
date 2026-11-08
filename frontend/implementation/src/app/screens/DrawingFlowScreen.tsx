/**
 * Drawing + prediction (Top-3 HITL) screen: wires FlowController state and decisions into DrawingScreen.
 */
import type { MutableRefObject } from "react";
import type { LevelDefinition } from "@/src/domain/levels";
import { getMissionConfigForLevel } from "@/src/domain/mission-config";
import type { DrawingSurface } from "@/src/input";
import { env } from "@/src/config/env";
import { DrawingScreen } from "@/src/components/drawing/DrawingScreen";
import type { FlowController, FlowStateSnapshot } from "../state-machine";

export interface DrawingFlowScreenProps {
  level: LevelDefinition;
  snapshot: FlowStateSnapshot;
  phase: "drawing" | "predicting" | "prediction-error" | "evaluating";
  controller: FlowController | null;
  providerMode: "mock" | "partner";
  surfaceRef: MutableRefObject<DrawingSurface | null>;
  /** Bumped on every redraw so the drawing screen remounts with a clean canvas. */
  drawingRevision: number;
  missionOpen: boolean;
  onOpenMission: () => void;
  onCloseMission: () => void;
  onSubmit: () => void;
  onExit: () => void;
}

/** Decision calls are guarded by the flow phase / picker validation, so a refusal is not an error to surface. */
function ignoreRefusedTransition(action: () => void): void {
  try {
    action();
  } catch {
    // Refused by the FlowController phase guard or the picker's DecisionError.
  }
}

export function DrawingFlowScreen({
  level,
  snapshot,
  phase,
  controller,
  providerMode,
  surfaceRef,
  drawingRevision,
  missionOpen,
  onOpenMission,
  onCloseMission,
  onSubmit,
  onExit,
}: DrawingFlowScreenProps) {
  return (
    <DrawingScreen
      key={level.levelId + String(snapshot.cyclesCompleted) + ":" + drawingRevision}
      level={level}
      missionConfig={getMissionConfigForLevel(level)}
      missionOpen={missionOpen}
      onOpenMission={onOpenMission}
      onCloseMission={onCloseMission}
      initialMode={env.defaultDrawInputMode}
      feedback={controller?.feedback ?? null}
      surfaceOut={surfaceRef}
      active={phase === "drawing"}
      phase={phase}
      prediction={controller?.prediction ?? null}
      errorDetail={controller?.errorDetail ?? null}
      predictionMode={providerMode}
      onAccept={() => ignoreRefusedTransition(() => controller?.decideAccept())}
      onCorrect={(rank) => ignoreRefusedTransition(() => controller?.decideCorrect(rank))}
      onOverride={(label) => ignoreRefusedTransition(() => controller?.decideOverride(label))}
      onRedraw={() => {
        if (phase === "prediction-error") {
          controller?.redrawFromError();
        } else {
          controller?.requestRedraw("evaluation");
        }
      }}
      onRetry={() => void controller?.retryPrediction()}
      onSubmit={onSubmit}
      onExit={onExit}
    />
  );
}
