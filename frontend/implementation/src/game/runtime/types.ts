/**
 * Public and shared types of the KAPLAY runtime.
 */
import type { GameObj, PosComp } from "kaplay";
import type { DrawingInput, LevelContext, ObjectBehavior } from "../../domain/types";
import type { WorldCreation } from "../creation-store";

export type GameOutcome = "success" | "fail";
export type GamePhase = "falling" | "placing" | "gameplay";
export type DirectionInput = { left: boolean; right: boolean; jump: boolean };
/** Any positioned object of the scene (platform, hazard, creation art). */
export type SceneObject = GameObj<PosComp>;

export interface KaplayGameHandle {
  selectCreation?(id: string): boolean;
  destroy(): void;
  setInput(i: DirectionInput): void;
  onFallComplete(): void;
  commitPlacementAt(x: number, y: number): boolean;
  setPlacement(x: number, y: number): boolean;
  retry(): void;
  reposition(): void;
}

export interface KaplayGameOptions {
  integrated?: boolean;
  creations?: WorldCreation[];
  onCreationsChange?: (items: WorldCreation[]) => void;
  canvas: HTMLCanvasElement;
  level: LevelContext;
  behavior: ObjectBehavior;
  finalLabel: string;
  drawingInput: DrawingInput | null;
  onOutcome(o: GameOutcome, reason?: string): void;
  onFallComplete(): void;
  onCommitPlacement(): void;
  onReposition(): void;
}
