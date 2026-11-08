/**
 * Shared types and constants of the world stage (GameStage and its hooks/components).
 */
import type { LevelDefinition } from "@/src/domain/levels";
import type {
  DrawingInput,
  HumanDecision,
  ObjectBehavior,
} from "@/src/domain/types";
import type { WorldCreation } from "@/src/game/creation-store";

export type DirectionKey = "left" | "right" | "jump";
export type DirectionState = Record<DirectionKey, boolean>;
export type StageOutcome = "success" | "fail";
export type StagePhase = "falling" | "placing" | "gameplay" | "complete";
/** "camera" = hand control on; "fallback" = keyboard / on-screen buttons. */
export type InputMode = "camera" | "fallback";

/** Never mutated: always copy with neutralInput() before storing. */
export const NEUTRAL_INPUT: Readonly<DirectionState> = {
  left: false,
  right: false,
  jump: false,
};

export function neutralInput(): DirectionState {
  return { ...NEUTRAL_INPUT };
}

export interface GameSummary {
  gameplay: string;
  literacy: string;
  decision: string;
}

export interface GameStageProps {
  characterDisplayName?: string | null;
  integrated?: boolean;
  creations?: WorldCreation[];
  onCreationsChange?: (items: WorldCreation[]) => void;
  onCreateAnotherObject?: () => void;
  level: LevelDefinition;
  behavior: ObjectBehavior;
  decision: HumanDecision;
  drawingInput: DrawingInput | null;
  phase: StagePhase;
  onOutcomeReported(o: StageOutcome): void;
  summary?: GameSummary;
  /** Fired once when the win is shown: record progress here. */
  onLevelWon?(): void;
  onBackToLevels?(): void;
  onOutcomeObserved?(o: StageOutcome): void;
  onRetry?(): void;
  onRedraw(): void;
  onFallComplete(): void;
  onCommitPlacement(): void;
  onReposition(): void;
}
