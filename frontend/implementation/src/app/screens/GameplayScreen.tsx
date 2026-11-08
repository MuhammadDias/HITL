/**
 * World gameplay screen (fall -> place -> play): wires FlowController state into the integrated GameStage.
 */
import type { LevelDefinition } from "@/src/domain/levels";
import { GameStage } from "@/src/components/game/GameStage";
import type { CreationStore, WorldCreation } from "@/src/game/creation-store";
import { recordCompletedStage } from "../level-progress";
import { buildLevelSummary } from "../level-summary";
import type { FlowController, FlowStateSnapshot } from "../state-machine";

export interface GameplayScreenProps {
  level: LevelDefinition;
  snapshot: FlowStateSnapshot;
  phase: "falling" | "placing" | "gameplay";
  controller: FlowController;
  characterDisplayName: string;
  creations: CreationStore;
  onCreationsChange: (items: WorldCreation[]) => void;
  /** Called before a redraw / "create another object" so the drawing screen remounts clean. */
  onBumpDrawingRevision: () => void;
  onBackToLevels: () => void;
}

export function GameplayScreen({
  level,
  snapshot,
  phase,
  controller,
  characterDisplayName,
  creations,
  onCreationsChange,
  onBumpDrawingRevision,
  onBackToLevels,
}: GameplayScreenProps) {
  const { behavior, decision } = snapshot;
  if (!behavior || !decision) return null;
  return (
    <GameStage
      integrated={true}
      characterDisplayName={characterDisplayName}
      creations={creations.snapshot()}
      onCreationsChange={onCreationsChange}
      onCreateAnotherObject={() => {
        onBumpDrawingRevision();
        controller.requestRedraw("create_another");
      }}
      level={level}
      behavior={behavior}
      decision={decision}
      onOutcomeReported={(outcome) => controller.reportGameplayOutcome(outcome)}
      summary={buildLevelSummary(level, decision, characterDisplayName)}
      onLevelWon={() => recordCompletedStage(level.stage)}
      onBackToLevels={onBackToLevels}
      onOutcomeObserved={(outcome) => controller.recordGameplayAttempt(outcome)}
      onRetry={() => controller.recordGameplayRetry()}
      onRedraw={() => {
        onBumpDrawingRevision();
        controller.requestRedraw("gameplay");
      }}
      onCommitPlacement={() => controller.commitPlacement()}
      onFallComplete={() => controller.completeFall()}
      drawingInput={controller.drawingInput}
      onReposition={() => controller.repositionObject()}
      phase={phase}
    />
  );
}
