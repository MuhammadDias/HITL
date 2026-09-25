import type { ObjectBehavior, SceneSpec } from "../domain/types";

/**
 * TASK 04 — Pure spawn planning: HumanDecision.finalLabel → behavior resolver
 * result → concrete KAPLAY entity plan. Gameplay NEVER spawns raw rank-1
 * output; React passes only the resolved behavior here (architecture invariant).
 */
export type SpawnKind = "bridge" | "fallback" | "hazard";

export interface SpawnPlan {
  kind: SpawnKind;
  label: string;
  /** Bridge spans the gap when crossable. */
  bridge: { x: number; y: number; w: number; h: number } | null;
  /** Hazard occupies the gap floor otherwise. */
  hazard: { x: number; y: number; w: number; h: number } | null;
}

const GROUND_THICKNESS = 14;

export function planSpawn(
  behavior: ObjectBehavior,
  finalLabel: string,
  scene: SceneSpec,
  canvasHeight: number,
): SpawnPlan {
  const topY = canvasHeight - GROUND_Y_OFFSET;
  switch (behavior) {
    case "solid":
      return {
        kind: "bridge",
        label: finalLabel,
        bridge: { x: scene.gapStartX, y: topY, w: scene.gapWidth, h: GROUND_THICKNESS },
        hazard: null,
      };
    case "unresolved":
      return {
        kind: "fallback",
        label: finalLabel,
        bridge: { x: scene.gapStartX, y: topY, w: scene.gapWidth, h: GROUND_THICKNESS },
        hazard: null,
      };
    case "danger":
    default:
      return {
        kind: "hazard",
        label: finalLabel,
        bridge: null,
        hazard: {
          x: scene.gapStartX,
          y: canvasHeight - GROUND_Y_OFFSET - HAZARD_DEPTH,
          w: scene.gapWidth,
          h: HAZARD_DEPTH,
        },
      };
  }
}

export const GROUND_Y_OFFSET = 60;
export const HAZARD_DEPTH = 42;

/** DEV/PLACEHOLDER palette for consequence objects (replaceable tokens). */
export const SPAWN_COLORS: Record<SpawnKind, [number, number, number]> = {
  bridge: [141, 110, 99],
  fallback: [144, 164, 174],
  hazard: [192, 57, 43],
};
